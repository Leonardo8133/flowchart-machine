import * as vscode from 'vscode';

export interface ConnectionViewResult {
  diagram: string;
  metadata: {
    hasData: boolean;
    nodes: number;
    edges: number;
    incomingDepth: number;
    outgoingDepth: number;
    message?: string;
  };
}

interface EntrySelection {
  type?: string;
  name?: string;
  class?: string;
  line_offset?: Record<string, number>;
  lineOffset?: Record<string, number>;
}

type NodeRole = 'root' | 'caller' | 'callee';

interface NodeInfo {
  id: string;
  definition: string;
  fileLabel: string;
  roles: Set<NodeRole>;
}

interface SubgraphInfo {
  id: string;
  label: string;
  nodes: Set<string>;
  roles: Set<NodeRole>;
}

interface PythonCallReference {
  key: string;
  identifier: string;
  qualifier?: string;
  hasQualifier: boolean;
}

interface PythonSymbolInfo {
  uri: vscode.Uri;
  name: string;
  className?: string;
  signature: string;
  range: vscode.Range;
  callReferences: Map<string, PythonCallReference[]>;
}

interface PythonImportInfo {
  modules: Set<string>;
  members: Set<string>;
}

interface PythonWorkspaceIndex {
  byKey: Map<string, PythonSymbolInfo[]>;
  byUri: Map<string, PythonSymbolInfo[]>;
  callersByKey: Map<string, Set<PythonSymbolInfo>>;
  importsByUri: Map<string, PythonImportInfo>;
}

const PYTHON_RESERVED_NAMES = new Set([
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'False',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'None',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'True',
  'try',
  'while',
  'with',
  'yield',
  'self',
  'cls',
  '__init__',
  '__name__',
  '__main__',
  'super'
]);

export class ConnectionViewService {
  private pythonIndexPromise: Promise<PythonWorkspaceIndex | null> | null = null;

  private getDepthConfig(): { incomingDepth: number; outgoingDepth: number } {
    const config = vscode.workspace.getConfiguration('flowchartMachine');
    const incoming = config.get<number>('connectionView.maxIncomingDepth', 3) ?? 3;
    const outgoing = config.get<number>('connectionView.maxOutgoingDepth', 4) ?? 4;
    const sanitize = (value: number) => {
      if (Number.isNaN(value) || value < 0) {
        return 0;
      }
      if (value > 8) {
        return 8;
      }
      return Math.floor(value);
    };
    return {
      incomingDepth: sanitize(incoming),
      outgoingDepth: sanitize(outgoing)
    };
  }

  async createFromMetadata(filePath: string, metadata: any): Promise<ConnectionViewResult | null> {
    if (!metadata || !metadata.entry_selection) {
      return null;
    }

    const entry: EntrySelection = metadata.entry_selection;
    if (!entry || entry.type === 'file') {
      return null;
    }

    try {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      return await this.buildConnectionView(document, entry);
    } catch (error) {
      console.warn('Connection view: unable to open document for connection analysis.', error);
      return this.createFallbackResult('Unable to open file for connection analysis.');
    }
  }

  private async buildConnectionView(document: vscode.TextDocument, entry: EntrySelection): Promise<ConnectionViewResult> {
    const position = this.resolveEntryPosition(document, entry);
    if (!position) {
      return this.createFallbackResult('Unable to locate the selected symbol in the document.');
    }

    const { incomingDepth, outgoingDepth } = this.getDepthConfig();

    let rootItems: vscode.CallHierarchyItem[] | undefined;
    try {
      rootItems = await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
        'vscode.prepareCallHierarchy',
        document.uri,
        position
      );
    } catch (error) {
      console.warn('Connection view: prepareCallHierarchy failed.', error);
      return this.buildFallbackConnectionView(document, entry, incomingDepth, outgoingDepth);
    }

    if (!rootItems || rootItems.length === 0) {
      return this.buildFallbackConnectionView(document, entry, incomingDepth, outgoingDepth);
    }

    const rootItem = this.pickRootItem(rootItems, entry) ?? rootItems[0];
    const nodes = new Map<string, NodeInfo>();
    const subgraphs = new Map<string, SubgraphInfo>();
    const edges = new Set<string>();

    this.ensureNode(rootItem, nodes, subgraphs, 'root');
    const outgoingVisited = new Set<string>([this.getItemKey(rootItem)]);
    const incomingVisited = new Set<string>([this.getItemKey(rootItem)]);

    await this.collectOutgoing(rootItem, 0, outgoingDepth, nodes, subgraphs, edges, outgoingVisited);
    await this.collectIncoming(rootItem, 0, incomingDepth, nodes, subgraphs, edges, incomingVisited);

    const diagram = this.buildDiagram(subgraphs, edges);
    const hasData = edges.size > 0 || nodes.size > 1;

    return {
      diagram,
      metadata: {
        hasData,
        nodes: nodes.size,
        edges: edges.size,
        incomingDepth,
        outgoingDepth,
        message: hasData ? undefined : 'No callers or callees were found for the selected symbol.'
      }
    };
  }

  private createFallbackResult(message: string): ConnectionViewResult {
    const diagram = this.createPlaceholderDiagram(message);
    return {
      diagram,
      metadata: {
        hasData: false,
        nodes: 1,
        edges: 0,
        incomingDepth: 0,
        outgoingDepth: 0,
        message
      }
    };
  }

  private createPlaceholderDiagram(message: string): string {
    const escaped = this.escapeLabel(message);
    return `graph LR\n    placeholder[\"${escaped}\"]`;
  }

  private async collectOutgoing(
    item: vscode.CallHierarchyItem,
    depth: number,
    maxDepth: number,
    nodes: Map<string, NodeInfo>,
    subgraphs: Map<string, SubgraphInfo>,
    edges: Set<string>,
    visited: Set<string>
  ): Promise<void> {
    if (depth >= maxDepth) {
      return;
    }

    let calls: vscode.CallHierarchyOutgoingCall[] | undefined;
    try {
      calls = await vscode.commands.executeCommand<vscode.CallHierarchyOutgoingCall[]>(
        'vscode.provideCallHierarchyOutgoingCalls',
        item
      );
    } catch (error) {
      console.warn('Connection view: provideCallHierarchyOutgoingCalls failed.', error);
      return;
    }

    if (!calls || calls.length === 0) {
      return;
    }

    const sourceId = nodes.get(this.getItemKey(item))?.id;
    if (!sourceId) {
      return;
    }

    for (const call of calls) {
      const target = call.to;
      const key = this.getItemKey(target);
      const targetInfo = this.ensureNode(target, nodes, subgraphs, 'callee');
      edges.add(`  ${sourceId} --> ${targetInfo.id}`);

      if (!visited.has(key)) {
        visited.add(key);
        await this.collectOutgoing(target, depth + 1, maxDepth, nodes, subgraphs, edges, visited);
      }
    }
  }

  private async collectIncoming(
    item: vscode.CallHierarchyItem,
    depth: number,
    maxDepth: number,
    nodes: Map<string, NodeInfo>,
    subgraphs: Map<string, SubgraphInfo>,
    edges: Set<string>,
    visited: Set<string>
  ): Promise<void> {
    if (depth >= maxDepth) {
      return;
    }

    let calls: vscode.CallHierarchyIncomingCall[] | undefined;
    try {
      calls = await vscode.commands.executeCommand<vscode.CallHierarchyIncomingCall[]>(
        'vscode.provideCallHierarchyIncomingCalls',
        item
      );
    } catch (error) {
      console.warn('Connection view: provideCallHierarchyIncomingCalls failed.', error);
      return;
    }

    if (!calls || calls.length === 0) {
      return;
    }

    const targetId = nodes.get(this.getItemKey(item))?.id;
    if (!targetId) {
      return;
    }

    for (const call of calls) {
      const source = call.from;
      const key = this.getItemKey(source);
      const sourceInfo = this.ensureNode(source, nodes, subgraphs, 'caller');
      edges.add(`  ${sourceInfo.id} --> ${targetId}`);

      if (!visited.has(key)) {
        visited.add(key);
        await this.collectIncoming(source, depth + 1, maxDepth, nodes, subgraphs, edges, visited);
      }
    }
  }

  private buildDiagram(subgraphs: Map<string, SubgraphInfo>, edges: Set<string>): string {
    const lines: string[] = ['graph LR'];
    const styleLines: string[] = [];

    for (const info of subgraphs.values()) {
      const escaped = this.escapeSubgraphLabel(info.label);
      lines.push(`  subgraph ${info.id}[\"${escaped}\"]`);
      for (const def of info.nodes) {
        lines.push(`    ${def}`);
      }
      lines.push('  end');

      const color = this.getSubgraphColor(info.roles);
      if (color) {
        styleLines.push(`  style ${info.id} fill:${color},stroke:#888,stroke-width:1px`);
      }
    }

    lines.push(...styleLines);

    for (const edge of edges) {
      lines.push(edge);
    }

    return lines.join('\n');
  }

  private ensureNode(
    item: vscode.CallHierarchyItem,
    nodes: Map<string, NodeInfo>,
    subgraphs: Map<string, SubgraphInfo>,
    role: NodeRole
  ): NodeInfo {
    const key = this.getItemKey(item);
    const existing = nodes.get(key);
    if (existing) {
      existing.roles.add(role);
      return existing;
    }

    const id = `node${nodes.size + 1}`;
    const label = this.buildNodeLabel(item, role === 'root');
    const isRootNode = role === 'root';
    const definition = isRootNode ? `${id}((\"${label}\"))` : `${id}[\"${label}\"]`;
    const fileLabel = this.getFileLabel(item.uri);

    const subgraph = this.getOrCreateSubgraph(subgraphs, fileLabel);
    subgraph.nodes.add(definition);
    if (!isRootNode) {
      subgraph.roles.add(role);
    }

    const info: NodeInfo = { id, definition, fileLabel, roles: new Set<NodeRole>([role]) };
    nodes.set(key, info);
    return info;
  }

  private getOrCreateSubgraph(
    subgraphs: Map<string, SubgraphInfo>,
    label: string
  ): SubgraphInfo {
    let info = subgraphs.get(label);
    if (!info) {
      const id = this.buildSubgraphId(label, subgraphs.size + 1);
      info = { id, label, nodes: new Set<string>(), roles: new Set<NodeRole>() };
      subgraphs.set(label, info);
    }
    return info;
  }

  private buildSubgraphId(label: string, index: number): string {
    const sanitized = label.replace(/[^A-Za-z0-9_]/g, '_') || 'subgraph';
    return `sg_${sanitized}_${index}`;
  }

  private getSubgraphColor(roles: Set<NodeRole>): string | null {
    const hasCaller = roles.has('caller');
    const hasCallee = roles.has('callee');
    if (hasCaller && !hasCallee) {
      return '#295673';
    }
    if (hasCallee && !hasCaller) {
      return '#2e572e';
    }
    return null;
  }

  private isReferenceImported(
    source: PythonSymbolInfo,
    reference: PythonCallReference,
    target: PythonSymbolInfo,
    index: PythonWorkspaceIndex
  ): boolean {
    if (target.uri.toString() === source.uri.toString()) {
      return true;
    }

    const importInfo = index.importsByUri.get(source.uri.toString());
    if (!importInfo) {
      return false;
    }

    if (reference.hasQualifier) {
      const qualifier = reference.qualifier;
      if (qualifier) {
        if (importInfo.modules.has(qualifier) || importInfo.members.has(qualifier)) {
          return true;
        }
      }
      return false;
    }

    return importInfo.members.has(reference.identifier);
  }

  private buildNodeLabel(item: vscode.CallHierarchyItem, isRoot: boolean): string {
    const parts: string[] = [];
    if (item.name) {
      parts.push(this.escapeLabel(item.name));
    }
    if (item.detail) {
      parts.push(this.escapeLabel(item.detail));
    }

    return parts.join('<br/>');
  }

  private getFileLabel(uri: vscode.Uri): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    const relative = workspaceFolder ? vscode.workspace.asRelativePath(uri, false) : uri.fsPath;
    return relative.replace(/\\/g, '/');
  }

  private getItemKey(item: vscode.CallHierarchyItem): string {
    const range = item.selectionRange ?? item.range;
    const line = range?.start.line ?? 0;
    return `${item.uri.toString()}#${item.name}#${line}`;
  }

  private escapeLabel(label: string): string {
    return label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '\'');
  }

  private escapeSubgraphLabel(label: string): string {
    return label.replace(/\"/g, '\'');
  }

  private pickRootItem(items: vscode.CallHierarchyItem[], entry: EntrySelection): vscode.CallHierarchyItem | undefined {
    if (!entry) {
      return items[0];
    }

    const name = entry.name;
    const className = entry.class;

    if (!name && !className) {
      return items[0];
    }

    const matches = items.filter(item => {
      if (name && item.name === name) {
        if (!className) {
          return true;
        }
        return item.detail?.includes(className) ?? false;
      }
      if (!name && className && item.name === className) {
        return true;
      }
      return false;
    });

    return matches[0] ?? items[0];
  }

  private resolveEntryPosition(document: vscode.TextDocument, entry: EntrySelection): vscode.Position | undefined {
    const offsets = entry.line_offset ?? entry.lineOffset ?? {};
    const key = this.getOffsetKey(entry);

    if (key && offsets && typeof offsets[key] === 'number') {
      const line = offsets[key];
      if (!Number.isNaN(line)) {
        return new vscode.Position(Math.max(0, line - 1), 0);
      }
    }

    return this.findPositionBySearch(document, entry);
  }

  private getOffsetKey(entry: EntrySelection): string | undefined {
    if (entry.type === 'function' && entry.name) {
      return entry.name;
    }
    if (entry.type === 'class') {
      if (entry.class && entry.name) {
        return `${entry.class}.${entry.name}`;
      }
      if (entry.class) {
        return entry.class;
      }
    }
    return undefined;
  }

  private findPositionBySearch(document: vscode.TextDocument, entry: EntrySelection): vscode.Position | undefined {
    const text = document.getText();
    if (entry.type === 'function' && entry.name) {
      const regex = new RegExp(`\\bdef\\s+${entry.name}\\s*\\(`, 'g');
      const match = regex.exec(text);
      if (match) {
        return document.positionAt(match.index);
      }
    }

    if (entry.type === 'class') {
      if (entry.class && entry.name) {
        const regex = new RegExp(`\\bdef\\s+${entry.name}\\s*\\(`, 'g');
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text))) {
          const pos = document.positionAt(match.index);
          const classRegex = new RegExp(`\\bclass\\s+${entry.class}\\b`, 'g');
          const classMatch = classRegex.exec(text.slice(0, match.index));
          if (classMatch) {
            return pos;
          }
        }
      }
      if (entry.class) {
        const regex = new RegExp(`\\bclass\\s+${entry.class}\\b`, 'g');
        const match = regex.exec(text);
        if (match) {
          return document.positionAt(match.index);
        }
      }
    }

    return undefined;
  }

  private async buildFallbackConnectionView(
    document: vscode.TextDocument,
    entry: EntrySelection,
    incomingDepth: number,
    outgoingDepth: number
  ): Promise<ConnectionViewResult> {
    if (document.languageId !== 'python') {
      return this.createFallbackResult('Call hierarchy is unavailable and Python fallback analysis cannot run for this language.');
    }

    const index = await this.getPythonIndex();
    if (!index) {
      return this.createFallbackResult('No Python files were found for connection analysis.');
    }

    const position = this.resolveEntryPosition(document, entry);
    const symbol = this.findPythonSymbolForEntry(document, position, entry, index);

    if (!symbol) {
      return this.createFallbackResult('Unable to resolve the selected Python symbol for fallback analysis.');
    }

    const nodes = new Map<string, NodeInfo>();
    const subgraphs = new Map<string, SubgraphInfo>();
    const edges = new Set<string>();

    const rootKey = this.getPythonSymbolKey(symbol);
    this.ensurePythonNode(symbol, nodes, subgraphs, 'root');

    const outgoingVisited = new Set<string>([rootKey]);
    const incomingVisited = new Set<string>([rootKey]);

    await this.collectPythonOutgoing(symbol, 0, outgoingDepth, index, nodes, subgraphs, edges, outgoingVisited);
    await this.collectPythonIncoming(symbol, 0, incomingDepth, index, nodes, subgraphs, edges, incomingVisited);

    const diagram = this.buildDiagram(subgraphs, edges);
    const hasData = edges.size > 0 || nodes.size > 1;

    return {
      diagram,
      metadata: {
        hasData,
        nodes: nodes.size,
        edges: edges.size,
        incomingDepth,
        outgoingDepth,
        message: hasData ? undefined : 'No callers or callees were found for the selected symbol.'
      }
    };
  }

  private async getPythonIndex(): Promise<PythonWorkspaceIndex | null> {
    if (this.pythonIndexPromise) {
      return this.pythonIndexPromise;
    }

    this.pythonIndexPromise = this.createPythonIndex();
    return this.pythonIndexPromise;
  }

  private async createPythonIndex(): Promise<PythonWorkspaceIndex | null> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return null;
    }

    const files = await vscode.workspace.findFiles(
      '**/*.py',
      '{**/.venv/**,**/venv/**,**/__pycache__/**,**/site-packages/**,**/node_modules/**,**/.git/**}',
      2000
    );

    if (files.length === 0) {
      return null;
    }

    const byKey = new Map<string, PythonSymbolInfo[]>();
    const byUri = new Map<string, PythonSymbolInfo[]>();
    const callersByKey = new Map<string, Set<PythonSymbolInfo>>();
    const importsByUri = new Map<string, PythonImportInfo>();

    for (const file of files) {
      let document: vscode.TextDocument;
      try {
        document = await vscode.workspace.openTextDocument(file);
      } catch (error) {
        console.warn('Connection view fallback: failed to open Python file', file.toString(), error);
        continue;
      }

      const analysis = this.analyzePythonDocument(document);
      const symbols = analysis.symbols;
      if (!symbols.length) {
        continue;
      }

      const uriKey = file.toString();
      byUri.set(uriKey, symbols);
      importsByUri.set(uriKey, analysis.importInfo);

      for (const symbol of symbols) {
        const keys = this.getPythonSymbolKeys(symbol);
        for (const key of keys) {
          if (!byKey.has(key)) {
            byKey.set(key, []);
          }
          byKey.get(key)!.push(symbol);
        }

        for (const callKey of symbol.callReferences.keys()) {
          if (!callersByKey.has(callKey)) {
            callersByKey.set(callKey, new Set<PythonSymbolInfo>());
          }
          callersByKey.get(callKey)!.add(symbol);
        }
      }
    }

    return {
      byKey,
      byUri,
      callersByKey,
      importsByUri
    };
  }

  private analyzePythonDocument(document: vscode.TextDocument): {
    symbols: PythonSymbolInfo[];
    importInfo: PythonImportInfo;
  } {
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    const symbols: PythonSymbolInfo[] = [];
    const classStack: { name: string; indent: number }[] = [];
    const importInfo = this.extractPythonImports(lines);

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      const indent = line.length - line.trimStart().length;

      while (classStack.length && indent <= classStack[classStack.length - 1].indent) {
        classStack.pop();
      }

      if (trimmed.startsWith('@')) {
        continue;
      }

      const classMatch = trimmed.match(/^class\s+([A-Za-z_][\w]*)/);
      if (classMatch) {
        const className = classMatch[1];
        classStack.push({ name: className, indent });
        continue;
      }

      const funcMatch = trimmed.match(/^def\s+([A-Za-z_][\w]*)\s*\(([^)]*)\)/);
      if (!funcMatch) {
        continue;
      }

      const name = funcMatch[1];
      const params = funcMatch[2]?.trim() ?? '';
      const classContext = classStack[classStack.length - 1];
      const signature = params.length > 0 ? `${name}(${params})` : `${name}()`;

      const endLine = this.findPythonBlockEnd(lines, i, indent);
      const range = new vscode.Range(i, 0, endLine, lines[endLine]?.length ?? 0);
      const body = lines.slice(i + 1, endLine + 1).join('\n');

      const callReferences = this.extractPythonCallReferences(body);

      const symbol: PythonSymbolInfo = {
        uri: document.uri,
        name,
        className: classContext ? classContext.name : undefined,
        signature,
        range,
        callReferences
      };

      symbols.push(symbol);
    }

    return { symbols, importInfo };
  }

  private findPythonBlockEnd(lines: string[], startLine: number, baseIndent: number): number {
    let endLine = startLine;

    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      const indent = line.length - line.trimStart().length;
      if (indent <= baseIndent) {
        break;
      }

      endLine = i;
    }

    return endLine;
  }

  private extractPythonCallReferences(body: string): Map<string, PythonCallReference[]> {
    const result = new Map<string, PythonCallReference[]>();
    if (!body) {
      return result;
    }

    const callRegex = /([A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*)\s*\(/g;
    let match: RegExpExecArray | null;

    while ((match = callRegex.exec(body))) {
      const expression = match[1];
      if (!expression) {
        continue;
      }

      const parts = expression.split('.');
      const identifier = parts[parts.length - 1];
      if (!identifier || PYTHON_RESERVED_NAMES.has(identifier)) {
        continue;
      }

      const hasQualifier = parts.length > 1;
      const qualifier = hasQualifier ? parts[parts.length - 2] : undefined;

      this.addPythonCallReference(result, {
        key: `function:${identifier}`,
        identifier,
        qualifier,
        hasQualifier
      });

      if (hasQualifier && qualifier && !PYTHON_RESERVED_NAMES.has(qualifier)) {
        this.addPythonCallReference(result, {
          key: `method:${qualifier}.${identifier}`,
          identifier,
          qualifier,
          hasQualifier: true
        });
      }
    }

    return result;
  }

  private addPythonCallReference(
    map: Map<string, PythonCallReference[]>,
    reference: PythonCallReference
  ): void {
    if (!map.has(reference.key)) {
      map.set(reference.key, []);
    }
    map.get(reference.key)!.push(reference);
  }

  private extractPythonImports(lines: string[]): PythonImportInfo {
    const modules = new Set<string>();
    const members = new Set<string>();

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      if (line.startsWith('import ')) {
        const importSection = line.slice('import '.length);
        const entries = importSection.split(',');
        for (const entry of entries) {
          const segment = entry.trim();
          if (!segment) {
            continue;
          }
          const [modulePart, aliasPart] = segment.split(/\s+as\s+/);
          const alias = (aliasPart ?? modulePart).trim();
          if (!alias) {
            continue;
          }
          for (const portion of alias.split('.')) {
            if (portion) {
              modules.add(portion);
            }
          }
        }
        continue;
      }

      if (line.startsWith('from ')) {
        const match = line.match(/^from\s+[A-Za-z0-9_\.]+\s+import\s+(.+)/);
        if (!match) {
          continue;
        }
        const importsSection = match[1];
        const entries = importsSection.split(',');
        for (const entry of entries) {
          const segment = entry.trim();
          if (!segment || segment === '*') {
            continue;
          }
          const [memberPart, aliasPart] = segment.split(/\s+as\s+/);
          const alias = (aliasPart ?? memberPart).trim();
          if (alias) {
            members.add(alias);
          }
        }
      }
    }

    return { modules, members };
  }

  private getPythonSymbolKeys(symbol: PythonSymbolInfo): string[] {
    const keys = [`function:${symbol.name}`];
    if (symbol.className) {
      keys.unshift(`method:${symbol.className}.${symbol.name}`);
    }
    return keys;
  }

  private getPythonSymbolKey(symbol: PythonSymbolInfo): string {
    return `${symbol.uri.toString()}#${symbol.className ?? ''}#${symbol.name}#${symbol.range.start.line}`;
  }

  private findPythonSymbolForEntry(
    document: vscode.TextDocument,
    position: vscode.Position | undefined,
    entry: EntrySelection,
    index: PythonWorkspaceIndex
  ): PythonSymbolInfo | undefined {
    const uriKey = document.uri.toString();
    const symbolsInFile = index.byUri.get(uriKey) ?? [];

    if (position) {
      const symbolAtPosition = symbolsInFile.find(sym => sym.range.contains(position));
      if (symbolAtPosition) {
        return symbolAtPosition;
      }
    }

    const keyCandidates: string[] = [];
    if (entry.class && entry.name) {
      keyCandidates.push(`method:${entry.class}.${entry.name}`);
    }
    if (entry.name) {
      keyCandidates.push(`function:${entry.name}`);
    }

    for (const key of keyCandidates) {
      const candidates = index.byKey.get(key);
      if (candidates && candidates.length) {
        const inSameFile = candidates.find(candidate => candidate.uri.toString() === uriKey);
        return inSameFile ?? candidates[0];
      }
    }

    if (symbolsInFile.length === 1) {
      return symbolsInFile[0];
    }

    if (position) {
      const nearest = symbolsInFile.find(sym => sym.range.start.line >= position.line);
      if (nearest) {
        return nearest;
      }
    }

    return undefined;
  }

  private ensurePythonNode(
    symbol: PythonSymbolInfo,
    nodes: Map<string, NodeInfo>,
    subgraphs: Map<string, SubgraphInfo>,
    role: NodeRole
  ): NodeInfo {
    const key = this.getPythonSymbolKey(symbol);
    const existing = nodes.get(key);
    if (existing) {
      existing.roles.add(role);
      return existing;
    }

    const id = `node${nodes.size + 1}`;
    const labelParts: string[] = [];
    const qualifiedName = symbol.className ? `${symbol.className}.${symbol.name}` : symbol.name;
    if (symbol.signature) {
      labelParts.push(this.escapeLabel(symbol.signature));
    } else {
      labelParts.push(this.escapeLabel(qualifiedName));
    }

    const label = labelParts.join('<br/>');
    const isRootNode = role === 'root';
    const definition = isRootNode ? `${id}((\"${label}\"))` : `${id}[\"${label}\"]`;
    const fileLabel = this.getFileLabel(symbol.uri);

    const subgraph = this.getOrCreateSubgraph(subgraphs, fileLabel);
    subgraph.nodes.add(definition);
    if (!isRootNode) {
      subgraph.roles.add(role);
    }

    const info: NodeInfo = { id, definition, fileLabel, roles: new Set<NodeRole>([role]) };
    nodes.set(key, info);
    return info;
  }

  private async collectPythonOutgoing(
    symbol: PythonSymbolInfo,
    depth: number,
    maxDepth: number,
    index: PythonWorkspaceIndex,
    nodes: Map<string, NodeInfo>,
    subgraphs: Map<string, SubgraphInfo>,
    edges: Set<string>,
    visited: Set<string>
  ): Promise<void> {
    if (depth >= maxDepth) {
      return;
    }

    const roleForSource: NodeRole = depth === 0 ? 'root' : 'callee';
    const sourceInfo = this.ensurePythonNode(symbol, nodes, subgraphs, roleForSource);
    const references = symbol.callReferences;

    for (const [callKey, refs] of references) {
      const targets = index.byKey.get(callKey);
      if (!targets || targets.length === 0) {
        continue;
      }

      for (const target of targets) {
        const hasResolvableReference = refs.some(ref =>
          this.isReferenceImported(symbol, ref, target, index)
        );
        if (!hasResolvableReference) {
          continue;
        }

        const key = this.getPythonSymbolKey(target);
        const targetInfo = this.ensurePythonNode(target, nodes, subgraphs, 'callee');
        edges.add(`  ${sourceInfo.id} --> ${targetInfo.id}`);

        if (!visited.has(key)) {
          visited.add(key);
          await this.collectPythonOutgoing(
            target,
            depth + 1,
            maxDepth,
            index,
            nodes,
            subgraphs,
            edges,
            visited
          );
        }
      }
    }
  }

  private async collectPythonIncoming(
    symbol: PythonSymbolInfo,
    depth: number,
    maxDepth: number,
    index: PythonWorkspaceIndex,
    nodes: Map<string, NodeInfo>,
    subgraphs: Map<string, SubgraphInfo>,
    edges: Set<string>,
    visited: Set<string>
  ): Promise<void> {
    if (depth >= maxDepth) {
      return;
    }

    const roleForTarget: NodeRole = depth === 0 ? 'root' : 'callee';
    const targetInfo = this.ensurePythonNode(symbol, nodes, subgraphs, roleForTarget);
    const symbolKeys = this.getPythonSymbolKeys(symbol);
    const callers = new Set<PythonSymbolInfo>();

    for (const key of symbolKeys) {
      const found = index.callersByKey.get(key);
      if (!found) {
        continue;
      }
      for (const caller of found) {
        const references = caller.callReferences.get(key);
        if (!references) {
          continue;
        }
        const hasResolvableReference = references.some(ref =>
          this.isReferenceImported(caller, ref, symbol, index)
        );
        if (hasResolvableReference) {
          callers.add(caller);
        }
      }
    }

    if (callers.size === 0) {
      return;
    }

    for (const caller of callers) {
      const callerKey = this.getPythonSymbolKey(caller);
      const callerInfo = this.ensurePythonNode(caller, nodes, subgraphs, 'caller');
      edges.add(`  ${callerInfo.id} --> ${targetInfo.id}`);

      if (!visited.has(callerKey)) {
        visited.add(callerKey);
        await this.collectPythonIncoming(
          caller,
          depth + 1,
          maxDepth,
          index,
          nodes,
          subgraphs,
          edges,
          visited
        );
      }
    }
  }
}
