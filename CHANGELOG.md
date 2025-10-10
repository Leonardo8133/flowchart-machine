# Change Log

All notable changes to the "flowchart-machine" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.0.2] - 2025-10-10
### Changed
- Restructured Python backend into organized module structure under `python/flowchart/`
- Refactored flowchart processor into separate handler modules for better maintainability
- Optimized line mapping creation to run once for entire file instead of per function/class
- Updated file service to work with new Python module structure

### Added
- Entry processor for handling different entry points (file, function, class, method)
- Comprehensive line mapping for all functions, classes, and methods
- Processor configuration module for centralized settings
- Unit tests for extension activation
- Service index for better module exports

### Fixed
- Improved .gitignore patterns
- Enhanced code organization and separation of concerns

## [1.0.1] - 2025-01-01
### Fixed
- Changelog Updated

## [0.0.1] - 2025-10-01
### Added
- Initial release of Flowchart Machine
- Generate flowcharts from Python using built-in `flowchart/main.py`
- Webview with Mermaid diagrams and collapsible subgraphs
- Settings for node processing, storage, and appearance
- Context menu and command palette integration