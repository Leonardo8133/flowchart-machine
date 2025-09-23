#!/usr/bin/env python3
"""
Complex test file for flowchart generation testing.
Contains various Python constructs: functions, conditionals, loops, imports, etc.
"""

import os
import sys
import json
from typing import List, Dict, Optional

def read_config_file(config_path: str) -> Dict[str, any]:
    """Read and parse configuration file."""
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        return config
    except FileNotFoundError:
        # print(f"Config file not found: {config_path}")
        return {}
    except json.JSONDecodeError:
        # print(f"Invalid JSON in config file: {config_path}")
        return {}

def validate_data(data: List[Dict]) -> tuple[bool, List[str]]:
    """Validate data structure and return validation status and errors."""
    errors = []
    is_valid = True
    
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            errors.append(f"Item {i} is not a dictionary")
            is_valid = False
            continue
            
        # if 'id' not in item:
        #     errors.append(f"Item {i} missing 'id' field")
        #     is_valid = False
            
        # if 'name' not in item:
        #     errors.append(f"Item {i} missing 'name' field")
        #     is_valid = False
    
    return is_valid, errors

def process_items(items: List[Dict], config: Dict) -> List[Dict]:
    """Process items based on configuration."""
    processed = []
    
    for item in items:
        # Apply filters
        if config.get('filter_enabled', False):
            if item.get('status') == 'inactive':
                continue
                
        # # Transform data
        # processed_item = item.copy()
        # if config.get('uppercase_names', False):
        #     processed_item['name'] = item['name'].upper()
            
        # if config.get('add_timestamp', False):
        #     import datetime
        #     processed_item['processed_at'] = datetime.datetime.now().isoformat()
            
        processed.append(processed_item)
    
    return processed

def calculate_statistics(data: List[Dict]) -> Dict[str, any]:
    """Calculate various statistics from the data."""
    if not data:
        return {'count': 0, 'avg_score': 0, 'status_counts': {}}
    
    total_score = sum(item.get('score', 0) for item in data)
    avg_score = total_score / len(data)
    
    # status_counts = {}
    # for item in data:
    #     status = item.get('status', 'unknown')
    #     status_counts[status] = status_counts.get(status, 0) + 1
    
    return {
        'count': len(data),
        'avg_score': round(avg_score, 2),
        'status_counts': status_counts
    }

def main2():
    """Main execution function."""
    # Check command line arguments
    if len(sys.argv) < 2:
        print("Usage: python complex_test.py <config_file>")
        sys.exit(1)
    
    config_file = sys.argv[1]
    
    # Read configuration
    config = read_config_file(config_file)
    if not config:
        print("Failed to read configuration, using defaults")
        config = {
            'filter_enabled': True,
            'uppercase_names': False,
            'add_timestamp': True
        }
    
    # Sample data
    sample_data = [
        {'id': 1, 'name': 'Alice', 'score': 85, 'status': 'active'},
        {'id': 2, 'name': 'Bob', 'score': 92, 'status': 'active'},
        {'id': 3, 'name': 'Charlie', 'score': 78, 'status': 'inactive'},
        {'id': 4, 'name': 'Diana', 'score': 95, 'status': 'active'},
        {'id': 5, 'name': 'Eve', 'score': 88, 'status': 'active'}
    ]
    
    # # Validate data
    # is_valid, errors = validate_data(sample_data)
    # if not is_valid:
    #     print("Data validation failed:")
    #     for error in errors:
    #         print(f"  - {error}")
    #     sys.exit(1)
    
    print("Data validation passed")
    
    # Process items
    processed_data = process_items(sample_data, config)
    print(f"Processed {len(processed_data)} items")
    
    # Calculate statistics
    # stats = calculate_statistics(processed_data)
    print(f"Statistics: {stats}")
    
    # # Save results
    # output_file = 'output_results.json'
    # try:
    #     with open(output_file, 'w') as f:
    #         json.dump({
    #             'processed_data': processed_data,
    #             'statistics': stats,
    #             'config_used': config
    #         }, f, indent=2)
    #     print(f"Results saved to {output_file}")
    # except Exception as e:
    #     print(f"Failed to save results: {e}")
    #     sys.exit(1)
    
    # print("Processing completed successfully")

if __name__ == "__main__":
    main2()
