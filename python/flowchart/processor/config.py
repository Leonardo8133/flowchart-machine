from typing import Dict, Tuple, List

class FlowchartConfig:
    """Configuration constants for flowchart generation."""
    
    SHAPES = {
        'start': ('[', ']'),
        'end': ('[', ']'),
        'condition': ('{"', '"}'),
        'loop': ('{{"', '"}}'),
        'merge': ('{{', '}}'),
        'print': ('["', '"]'),
        'function_call': ('[["', '"]]'),
        'import': ('[/"', r'"\]'),
        'exit': ('[/"', r'"\]'),
        'exception': ('[["', '"]]'),
        'finally': ('[/"', r'"\]'),
        'try': ('{"', '"}'),
        'catch': ('[["', '"]]'),
    }
    
    NODE_LIMITS = {
        'max_text_length': 80,
        'condition_truncate': 30
    }
    
    MAX_NODES = 100
    MAX_NESTING_DEPTH = 6  # Maximum number of nested function call layers
    MAX_SUBGRAPH_NODES = 25  # Maximum nodes before subgraph becomes collapsible
    
    EXIT_FUNCTIONS = ['sys.exit', 'os._exit', 'exit', 'quit']
