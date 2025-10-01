import ast

def process_entry(code: str, entry_type: str, entry_name: str | None, entry_class: str | None = None) -> str:
    """Process the entry point of the code."""

    # If analyzing entire file, return code as-is
    if entry_type == 'file':
        return code

    # For function/class analysis, create focused snippet
    target_src = None
    call_line = ""
    if entry_type == 'function':
        if entry_class:
            target_src, call_line = process_class_method(code, entry_class, entry_name)
        else:
            target_src, call_line = process_function(code, entry_name)
    elif entry_type == 'class':
        if entry_class and not entry_name:
            target_src, call_line = process_class(code, entry_class, entry_name)
        elif entry_class and entry_name:
            target_src, call_line = process_class_method(code, entry_class, entry_name)

    if target_src:
        code = "\n".join([target_src, call_line])
    return code

def process_function(code: str, entry_name: str) -> tuple[str, str]:
    """Process the function entry point of the code."""
    parsed = ast.parse(code)
    for node in parsed.body:
        if isinstance(node, ast.FunctionDef) and node.name == entry_name:
            return ast.get_source_segment(code, node), f"\n\n{entry_name}()\n"
    return None, ""

def process_class(code: str, entry_class: str, entry_name: str | None) -> tuple[str, str]:
    """Process the class entry point of the code."""
    parsed = ast.parse(code)
    for node in parsed.body:
        if isinstance(node, ast.ClassDef) and node.name == entry_class:
            return ast.get_source_segment(code, node), f"\n\n{entry_class}()\n"
    return None, ""

def process_class_method(code: str, entry_class: str, entry_name: str) -> tuple[str, str]:
    """Process the class method entry point of the code."""
    parsed = ast.parse(code)
    for node in parsed.body:
        if isinstance(node, ast.ClassDef) and node.name == entry_class:
            return ast.get_source_segment(code, node), f"\n\n{entry_class}.{entry_name}()\n"
    return None, ""
