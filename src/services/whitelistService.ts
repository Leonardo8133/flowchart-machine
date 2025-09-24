/**
 * WhitelistService manages persistent in-memory storage for subgraph whitelist
 * This service maintains the whitelist across regenerations but resets on new command calls
 * Each file gets its own instance to prevent cross-contamination
 */
export class WhitelistService {
    private whitelist: Set<string> = new Set();
    private forceCollapseList: Set<string> = new Set();
    private isActive: boolean = false;
    private fileKey: string = '';
    private static instances: Map<string, WhitelistService> = new Map();

    constructor(fileKey: string) {
        
        // Check if there is already an instance for the file key. If yes, return it instead of creating a new one
        const instances = (WhitelistService as any).instances as Map<string, WhitelistService>;
        if (instances.has(fileKey)) {
            return instances.get(fileKey)!;
        }
        this.fileKey = fileKey;
        instances.set(fileKey, this);
    }
    /**
     * Start a new session - resets whitelist and marks as active
     */
    public startSession(): void {
        this.whitelist.clear();
        this.isActive = true;
    }

    /**
     * Add a subgraph to the whitelist
     */
    public addToWhitelist(scopeName: string): void {
        if (!this.isActive) {
            return;
        }
        
        this.whitelist.add(scopeName);
        console.log(`WhitelistService: Added '${scopeName}' to whitelist`);
        console.log('WhitelistService: Current whitelist:', Array.from(this.whitelist));
    }

    /**
     * Remove a subgraph from the whitelist
     */
    public removeFromWhitelist(scopeName: string): void {
        this.whitelist.delete(scopeName);
        console.log(`WhitelistService: Removed '${scopeName}' from whitelist`);
    }

    /**
     * Check if a subgraph is whitelisted
     */
    public isWhitelisted(scopeName: string): boolean {
        return this.whitelist.has(scopeName);
    }

    /**
     * Get the current whitelist as an array
     */
    public getWhitelist(): string[] {
        return Array.from(this.whitelist);
    }

    /**
     * Clear the whitelist
     */
    public clearWhitelist(): void {
        this.whitelist.clear();
    }

    /**
     * Add a subgraph to the force collapse list
     */
    public addToForceCollapseList(scopeName: string): void {
        if (!this.isActive) {
            console.warn('WhitelistService: Cannot add to force collapse list - no active session');
            return;
        }
        
        this.forceCollapseList.add(scopeName);
        console.log(`WhitelistService: Added '${scopeName}' to force collapse list`);
        console.log('WhitelistService: Current force collapse list:', Array.from(this.forceCollapseList));
    }

    /**
     * Remove a subgraph from the force collapse list
     */
    public removeFromForceCollapseList(scopeName: string): void {
        this.forceCollapseList.delete(scopeName);
        console.log(`WhitelistService: Removed '${scopeName}' from force collapse list`);
    }

    /**
     * Check if a subgraph is in the force collapse list
     */
    public isForceCollapsed(scopeName: string): boolean {
        return this.forceCollapseList.has(scopeName);
    }

    /**
     * Get the current force collapse list as an array
     */
    public getForceCollapseList(): string[] {
        return Array.from(this.forceCollapseList);
    }

    /**
     * Clear the force collapse list
     */
    public clearForceCollapseList(): void {
        this.forceCollapseList.clear();
        console.log('WhitelistService: Force collapse list cleared');
    }

    public collapseAllSubgraphs(): void {
        // Clear both lists to ensure all subgraphs are collapsed
        this.forceCollapseList.clear();
        this.whitelist.clear();
        console.log('WhitelistService: All subgraphs will be collapsed');
    }
}
