import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Matches "from './...'"
    new_content = re.sub(r"from (['\"])([.][^'\"]+?)(['\"])", lambda m: f"from {m.group(1)}{m.group(2)}.js{m.group(3)}" if not m.group(2).endswith('.js') else m.group(0), content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Updated {filepath}')

for root, _, files in os.walk('packages/catalog/src'):
    for file in files:
        if file.endswith('.ts'):
            process_file(os.path.join(root, file))
