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

interface NodeInfo {
  id: string;
  definition: string;
  fileLabel: string;
}

interface PythonSymbolInfo {
  uri: vscode.Uri;
  name: string;
  className?: string;
  signature: string;
  range: vscode.Range;
  callKeys: Set<string>;
}

interface PythonWorkspaceIndex {
  byKey: Map<string, PythonSymbolInfo[]>;
  byUri: Map<string, PythonSymbolInfo[]>;
  callersByKey: Map<string, Set<PythonSymbolInfo>>;
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
    const subgraphs = new Map<string, Set<string>>();
    const edges = new Set<string>();

    this.ensureNode(rootItem, nodes, subgraphs, true);
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
    return `graph TD\n    placeholder[\"${escaped}\"]`;
  }

  private async collectOutgoing(
    item: vscode.CallHierarchyItem,
    depth: number,
    maxDepth: number,
    nodes: Map<string, NodeInfo>,
    subgraphs: Map<string, Set<string>>,
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
      const targetInfo = this.ensureNode(target, nodes, subgraphs);
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
    subgraphs: Map<string, Set<string>>,
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
      const sourceInfo = this.ensureNode(source, nodes, subgraphs);
      edges.add(`  ${sourceInfo.id} --> ${targetId}`);

      if (!visited.has(key)) {
        visited.add(key);
        await this.collectIncoming(source, depth + 1, maxDepth, nodes, subgraphs, edges, visited);
      }
    }
  }

  private buildDiagram(subgraphs: Map<string, Set<string>>, edges: Set<string>): string {
    const lines: string[] = ['graph TD'];

    for (const [label, nodeDefinitions] of subgraphs) {
      const escaped = this.escapeSubgraphLabel(label);
      lines.push(`  subgraph \"${escaped}\"`);
      for (const def of nodeDefinitions) {
        lines.push(`    ${def}`);
      }
      lines.push('  end');
    }

    for (const edge of edges) {
      lines.push(edge);
    }

    return lines.join('\n');
  }

  private ensureNode(
    item: vscode.CallHierarchyItem,
    nodes: Map<string, NodeInfo>,
    subgraphs: Map<string, Set<string>>,
    isRoot: boolean = false
  ): NodeInfo {
    const key = this.getItemKey(item);
    const existing = nodes.get(key);
    if (existing) {
      return existing;
    }

    const id = `node${nodes.size + 1}`;
    const label = this.buildNodeLabel(item, isRoot);
    const definition = isRoot ? `${id}((\"${label}\"))` : `${id}[\"${label}\"]`;
    const fileLabel = this.getFileLabel(item.uri);

    if (!subgraphs.has(fileLabel)) {
      subgraphs.set(fileLabel, new Set<string>());
    }
    subgraphs.get(fileLabel)!.add(definition);

    const info: NodeInfo = { id, definition, fileLabel };
    nodes.set(key, info);
    return info;
  }

  private buildNodeLabel(item: vscode.CallHierarchyItem, isRoot: boolean): string {
    const parts: string[] = [];
    if (item.name) {
      parts.push(this.escapeLabel(item.name));
    }
    if (item.detail) {
      parts.push(this.escapeLabel(item.detail));
    }

    const line = item.selectionRange?.start.line ?? item.range?.start.line;
    if (typeof line === 'number') {
      parts.push(`Line ${line + 1}`);
    }

    if (isRoot) {
      parts.push('Selected');
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

  private escapeForPlaceholder(label: string): string {
    return label.replace(/\"/g, '\'').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    const subgraphs = new Map<string, Set<string>>();
    const edges = new Set<string>();

    const rootKey = this.getPythonSymbolKey(symbol);
    this.ensurePythonNode(symbol, nodes, subgraphs, true);

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

    for (const file of files) {
      let document: vscode.TextDocument;
      try {
        document = await vscode.workspace.openTextDocument(file);
      } catch (error) {
        console.warn('Connection view fallback: failed to open Python file', file.toString(), error);
        continue;
      }

      const symbols = this.parsePythonDocument(document);
      if (!symbols.length) {
        continue;
      }

      byUri.set(file.toString(), symbols);

      for (const symbol of symbols) {
        const keys = this.getPythonSymbolKeys(symbol);
        for (const key of keys) {
          if (!byKey.has(key)) {
            byKey.set(key, []);
          }
          byKey.get(key)!.push(symbol);
        }

        for (const callKey of symbol.callKeys) {
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
      callersByKey
    };
  }

  private parsePythonDocument(document: vscode.TextDocument): PythonSymbolInfo[] {
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    const symbols: PythonSymbolInfo[] = [];
    const classStack: { name: string; indent: number }[] = [];

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

      const callKeys = this.extractPythonCallKeys(body);

      const symbol: PythonSymbolInfo = {
        uri: document.uri,
        name,
        className: classContext ? classContext.name : undefined,
        signature,
        range,
        callKeys
      };

      symbols.push(symbol);
    }

    return symbols;
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

  private extractPythonCallKeys(body: string): Set<string> {
    const result = new Set<string>();
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
      const method = parts[parts.length - 1];
      if (!method || PYTHON_RESERVED_NAMES.has(method)) {
        continue;
      }

      result.add(`function:${method}`);

      if (parts.length >= 2) {
        const qualifier = parts[parts.length - 2];
        if (qualifier && !PYTHON_RESERVED_NAMES.has(qualifier)) {
          result.add(`method:${qualifier}.${method}`);
        }
      }
    }

    return result;
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
    subgraphs: Map<string, Set<string>>,
    isRoot: boolean = false
  ): NodeInfo {
    const key = this.getPythonSymbolKey(symbol);
    const existing = nodes.get(key);
    if (existing) {
      return existing;
    }

    const id = `node${nodes.size + 1}`;
    const labelParts: string[] = [];
    const qualifiedName = symbol.className ? `${symbol.className}.${symbol.name}` : symbol.name;
    labelParts.push(this.escapeLabel(qualifiedName));
    if (symbol.signature) {
      labelParts.push(this.escapeLabel(symbol.signature));
    }
    labelParts.push(`Line ${symbol.range.start.line + 1}`);
    if (isRoot) {
      labelParts.push('Selected');
    }

    const label = labelParts.join('<br/>');
    const definition = isRoot ? `${id}((\"${label}\"))` : `${id}[\"${label}\"]`;
    const fileLabel = this.getFileLabel(symbol.uri);

    if (!subgraphs.has(fileLabel)) {
      subgraphs.set(fileLabel, new Set<string>());
    }
    subgraphs.get(fileLabel)!.add(definition);

    const info: NodeInfo = { id, definition, fileLabel };
    nodes.set(key, info);
    return info;
  }

  private ensurePythonPlaceholderNode(
    callKey: string,
    nodes: Map<string, NodeInfo>,
    subgraphs: Map<string, Set<string>>
  ): NodeInfo {
    const key = `placeholder:${callKey}`;
    const existing = nodes.get(key);
    if (existing) {
      return existing;
    }

    const id = `node${nodes.size + 1}`;
    const label = this.escapeForPlaceholder(this.describeCallKey(callKey));
    const definition = `${id}[\"${label}\"]`;
    const placeholderGroup = 'Unresolved references';
    if (!subgraphs.has(placeholderGroup)) {
      subgraphs.set(placeholderGroup, new Set<string>());
    }
    subgraphs.get(placeholderGroup)!.add(definition);

    const info: NodeInfo = { id, definition, fileLabel: placeholderGroup };
    nodes.set(key, info);
    return info;
  }

  private describeCallKey(callKey: string): string {
    if (callKey.startsWith('method:')) {
      const [, name] = callKey.split(':');
      return `${name} (unresolved)`;
    }
    if (callKey.startsWith('function:')) {
      const [, name] = callKey.split(':');
      return `${name} (unresolved)`;
    }
    return `Unresolved (${callKey})`;
  }

  private async collectPythonOutgoing(
    symbol: PythonSymbolInfo,
    depth: number,
    maxDepth: number,
    index: PythonWorkspaceIndex,
    nodes: Map<string, NodeInfo>,
    subgraphs: Map<string, Set<string>>,
    edges: Set<string>,
    visited: Set<string>
  ): Promise<void> {
    if (depth >= maxDepth) {
      return;
    }

    const sourceInfo = this.ensurePythonNode(symbol, nodes, subgraphs);
    const callKeys = Array.from(symbol.callKeys);

    for (const callKey of callKeys) {
      const targets = index.byKey.get(callKey);

      if (!targets || targets.length === 0) {
        const placeholder = this.ensurePythonPlaceholderNode(callKey, nodes, subgraphs);
        edges.add(`  ${sourceInfo.id} --> ${placeholder.id}`);
        continue;
      }

      for (const target of targets) {
        const key = this.getPythonSymbolKey(target);
        const targetInfo = this.ensurePythonNode(target, nodes, subgraphs);
        edges.add(`  ${sourceInfo.id} --> ${targetInfo.id}`);

        if (!visited.has(key)) {
          visited.add(key);
          await this.collectPythonOutgoing(target, depth + 1, maxDepth, index, nodes, subgraphs, edges, visited);
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
    subgraphs: Map<string, Set<string>>,
    edges: Set<string>,
    visited: Set<string>
  ): Promise<void> {
    if (depth >= maxDepth) {
      return;
    }

    const targetInfo = this.ensurePythonNode(symbol, nodes, subgraphs);
    const symbolKeys = this.getPythonSymbolKeys(symbol);
    const callers = new Set<PythonSymbolInfo>();

    for (const key of symbolKeys) {
      const found = index.callersByKey.get(key);
      if (!found) {
        continue;
      }
      for (const caller of found) {
        callers.add(caller);
      }
    }

    if (callers.size === 0) {
      return;
    }

    for (const caller of callers) {
      const callerKey = this.getPythonSymbolKey(caller);
      const callerInfo = this.ensurePythonNode(caller, nodes, subgraphs);
      edges.add(`  ${callerInfo.id} --> ${targetInfo.id}`);

      if (!visited.has(callerKey)) {
        visited.add(callerKey);
        await this.collectPythonIncoming(caller, depth + 1, maxDepth, index, nodes, subgraphs, edges, visited);
      }
    }
  }
}
