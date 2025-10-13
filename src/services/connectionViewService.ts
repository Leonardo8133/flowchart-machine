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

export class ConnectionViewService {
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
      return this.createFallbackResult('Call hierarchy is not supported for this symbol.');
    }

    if (!rootItems || rootItems.length === 0) {
      return this.createFallbackResult('No call hierarchy information is available for this symbol.');
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
}
