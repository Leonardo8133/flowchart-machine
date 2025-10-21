# Documentation Index

Complete reference for the Python Flowchart Processor.

---

## Quick Links

| Document | Description | Audience |
|----------|-------------|----------|
| **[README](README.md)** | Start here - overview and quick start | Everyone |
| **[schema.json](schema.json)** | Machine-readable specification | AI/Tools |
| **[NODE_TYPES](NODE_TYPES.md)** | Complete node reference (26+ types) | Developers |
| **[CONFIGURATION](CONFIGURATION.md)** | Environment variables and settings | Users |
| **[SUBGRAPHS](SUBGRAPHS.md)** | How classes/methods are organized | Users |
| **[CONNECTIONS](CONNECTIONS.md)** | Flow and connection types | Developers |
| **[ENTRY_POINTS](ENTRY_POINTS.md)** | Focusing on specific code | Users |
| **[TYPE_TRACKING](TYPE_TRACKING.md)** | How method calls are resolved | Developers |
| **[ADVANCED_FEATURES](ADVANCED_FEATURES.md)** | Recursion, breakpoints, limits | Advanced Users |
| **[COLLAPSE_PRIORITY](COLLAPSE_PRIORITY.md)** | Subgraph collapse rules | Users |
| **[CLARIFICATIONS_NEEDED](CLARIFICATIONS_NEEDED.md)** | Edge cases and questions | Maintainers |

---

## By Use Case

### I Want to...

#### Generate a Basic Flowchart
1. Start with **[README](README.md)** for quick start
2. Check **[CONFIGURATION](CONFIGURATION.md)** for display options
3. Review **[NODE_TYPES](NODE_TYPES.md)** to understand what you'll see

#### Focus on Specific Code
1. Read **[ENTRY_POINTS](ENTRY_POINTS.md)** for targeting functions/classes
2. Configure with environment variables from **[CONFIGURATION](CONFIGURATION.md)**
3. Use **[COLLAPSE_PRIORITY](COLLAPSE_PRIORITY.md)** to control what's shown

#### Understand Why Something Doesn't Work
1. Check **[TYPE_TRACKING](TYPE_TRACKING.md)** for method resolution issues
2. Review **[CLARIFICATIONS_NEEDED](CLARIFICATIONS_NEEDED.md)** for known limitations
3. See **[ADVANCED_FEATURES](ADVANCED_FEATURES.md)** for limits and error nodes

#### Customize Visualization
1. **[CONFIGURATION](CONFIGURATION.md)** for toggle flags
2. **[SUBGRAPHS](SUBGRAPHS.md)** for collapse control
3. **[COLLAPSE_PRIORITY](COLLAPSE_PRIORITY.md)** for fine-grained control

#### Integrate with Tools
1. **[schema.json](schema.json)** for machine-readable spec
2. **[README](README.md)** for output format details
3. **[NODE_TYPES](NODE_TYPES.md)** for node structure

#### Debug Issues
1. **[ADVANCED_FEATURES](ADVANCED_FEATURES.md)** for breakpoints
2. **[TYPE_TRACKING](TYPE_TRACKING.md)** for resolution debugging
3. **[CLARIFICATIONS_NEEDED](CLARIFICATIONS_NEEDED.md)** for known issues

#### Contribute to Project
1. **[CLARIFICATIONS_NEEDED](CLARIFICATIONS_NEEDED.md)** for open questions
2. All docs to understand architecture
3. **[schema.json](schema.json)** for formal specification

---

## By Topic

### Core Concepts
- **Nodes**: [NODE_TYPES](NODE_TYPES.md)
- **Connections**: [CONNECTIONS](CONNECTIONS.md)
- **Scopes**: [SUBGRAPHS](SUBGRAPHS.md)
- **Subgraphs**: [SUBGRAPHS](SUBGRAPHS.md)

### Configuration
- **Environment Variables**: [CONFIGURATION](CONFIGURATION.md)
- **Entry Points**: [ENTRY_POINTS](ENTRY_POINTS.md)
- **Collapse Rules**: [COLLAPSE_PRIORITY](COLLAPSE_PRIORITY.md)

### Advanced Topics
- **Type Resolution**: [TYPE_TRACKING](TYPE_TRACKING.md)
- **Recursion**: [ADVANCED_FEATURES](ADVANCED_FEATURES.md)
- **Breakpoints**: [ADVANCED_FEATURES](ADVANCED_FEATURES.md)
- **Error Handling**: [ADVANCED_FEATURES](ADVANCED_FEATURES.md)

### Reference
- **Machine Spec**: [schema.json](schema.json)
- **Limitations**: [CLARIFICATIONS_NEEDED](CLARIFICATIONS_NEEDED.md)

---

## Documentation Structure

```
docs/
├── README.md                    # Start here
├── INDEX.md                     # This file
├── schema.json                  # Machine-readable spec
│
├── Core Features/
│   ├── NODE_TYPES.md           # All 26+ node types
│   ├── CONNECTIONS.md          # Flow and arrows
│   └── SUBGRAPHS.md            # Class/method organization
│
├── Configuration/
│   ├── CONFIGURATION.md        # All env variables
│   ├── ENTRY_POINTS.md         # Code focusing
│   └── COLLAPSE_PRIORITY.md    # Subgraph rules
│
├── Advanced/
│   ├── TYPE_TRACKING.md        # Method resolution
│   ├── ADVANCED_FEATURES.md    # Special features
│   └── CLARIFICATIONS_NEEDED.md # Edge cases
```

---

## Key Concepts Quick Reference

### Nodes
26+ types including if, for, while, function calls, method calls, print, assignment, return, try/except, and more.

**See**: [NODE_TYPES](NODE_TYPES.md)

### Connections
- `-->` Standard flow
- `<-->` Call and return (bidirectional)
- `-->|label|` Labeled flow

**See**: [CONNECTIONS](CONNECTIONS.md)

### Scopes
- `None` - Main flow
- `functionName` - Function
- `class_ClassName` - Class
- `class_ClassName_methodName` - Method

**See**: [SUBGRAPHS](SUBGRAPHS.md)

### Type Tracking
- `variable_types` - Variable to class mapping
- `parameter_types` - Parameter to class mapping (by scope)
- `attribute_types` - Attribute to class mapping (by scope)

**See**: [TYPE_TRACKING](TYPE_TRACKING.md)

### Entry Points
- `file` - Entire file (default)
- `function` - Specific function
- `class` - Entire class

**See**: [ENTRY_POINTS](ENTRY_POINTS.md)

### Environment Variables

**Display** (11 flags):
`SHOW_PRINTS`, `SHOW_FUNCTIONS`, `SHOW_FOR_LOOPS`, `SHOW_WHILE_LOOPS`, `SHOW_VARIABLES`, `SHOW_IFS`, `SHOW_IMPORTS`, `SHOW_EXCEPTIONS`, `SHOW_RETURNS`, `SHOW_CLASSES`, `MERGE_COMMON_NODES`

**Entry** (3 vars):
`ENTRY_TYPE`, `ENTRY_NAME`, `ENTRY_CLASS`

**Collapse** (3 vars):
`MAX_SUBGRAPH_NODES`, `SUBGRAPH_WHITELIST`, `FORCE_COLLAPSE_LIST`

**Limits** (2 vars):
`MAX_NODES`, `MAX_NESTING_DEPTH`

**Breakpoints** (2 vars):
`HAS_BREAKPOINTS`, `BREAKPOINT_LINES`

**See**: [CONFIGURATION](CONFIGURATION.md)

---

## Reading Order by Skill Level

### Beginner
1. [README](README.md) - Overview
2. [NODE_TYPES](NODE_TYPES.md) - What you'll see
3. [CONFIGURATION](CONFIGURATION.md) - Basic settings
4. [ENTRY_POINTS](ENTRY_POINTS.md) - Focusing

### Intermediate
1. [SUBGRAPHS](SUBGRAPHS.md) - Organization
2. [CONNECTIONS](CONNECTIONS.md) - Flow details
3. [COLLAPSE_PRIORITY](COLLAPSE_PRIORITY.md) - Control
4. [ADVANCED_FEATURES](ADVANCED_FEATURES.md) - Special cases

### Advanced
1. [TYPE_TRACKING](TYPE_TRACKING.md) - Resolution system
2. [CLARIFICATIONS_NEEDED](CLARIFICATIONS_NEEDED.md) - Limitations
3. [schema.json](schema.json) - Formal spec
4. All source code in `processor/`

---

## Common Questions

### Why isn't my method call working?
**See**: [TYPE_TRACKING](TYPE_TRACKING.md) - Type resolution section

### How do I hide print statements?
**See**: [CONFIGURATION](CONFIGURATION.md) - `SHOW_PRINTS` variable

### How do I focus on one function?
**See**: [ENTRY_POINTS](ENTRY_POINTS.md) - Function entry type

### Why is my subgraph collapsed?
**See**: [COLLAPSE_PRIORITY](COLLAPSE_PRIORITY.md) - Priority rules

### What does the red circle mean?
**See**: [ADVANCED_FEATURES](ADVANCED_FEATURES.md) - Breakpoints section

### How do I prevent recursion loops?
**See**: [ADVANCED_FEATURES](ADVANCED_FEATURES.md) - Recursion detection (automatic)

### Can I use type hints?
**See**: [CLARIFICATIONS_NEEDED](CLARIFICATIONS_NEEDED.md) - Type hints section (not currently supported)

---

## Document Cross-References

### From README
- → [NODE_TYPES](NODE_TYPES.md) for node details
- → [CONFIGURATION](CONFIGURATION.md) for settings
- → [ENTRY_POINTS](ENTRY_POINTS.md) for focusing

### From CONFIGURATION
- → [ENTRY_POINTS](ENTRY_POINTS.md) for entry variables
- → [COLLAPSE_PRIORITY](COLLAPSE_PRIORITY.md) for collapse rules
- → [NODE_TYPES](NODE_TYPES.md) for what flags affect

### From NODE_TYPES
- → [CONNECTIONS](CONNECTIONS.md) for connection details
- → [SUBGRAPHS](SUBGRAPHS.md) for subgraph creation
- → [CONFIGURATION](CONFIGURATION.md) for visibility flags

### From SUBGRAPHS
- → [COLLAPSE_PRIORITY](COLLAPSE_PRIORITY.md) for collapse rules
- → [CONNECTIONS](CONNECTIONS.md) for subgraph connections
- → [TYPE_TRACKING](TYPE_TRACKING.md) for method resolution

### From TYPE_TRACKING
- → [NODE_TYPES](NODE_TYPES.md) for tracking nodes
- → [ADVANCED_FEATURES](ADVANCED_FEATURES.md) for error nodes
- → [CLARIFICATIONS_NEEDED](CLARIFICATIONS_NEEDED.md) for limitations

---

## Getting Help

1. **Check docs**: Use this index to find relevant documentation
2. **Review examples**: See `tests/test_examples/*.py` for real code samples
3. **Check schema**: [schema.json](schema.json) for formal specification
4. **Review clarifications**: [CLARIFICATIONS_NEEDED](CLARIFICATIONS_NEEDED.md) for known issues

---

## Contributing to Documentation

When updating documentation:

1. **Update schema.json** if adding features
2. **Cross-reference** related documents
3. **Add examples** with code and flowchart output
4. **Update this index** with new content
5. **Check CLARIFICATIONS_NEEDED** - move resolved items to proper docs

---

## Version

Documentation Version: 1.0  
Processor Version: 1.0  
Last Updated: 2024

---

**[Back to Top](#documentation-index)**

