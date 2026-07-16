const fs = require('fs');
const content = fs.readFileSync('c:/Users/napog/.gemini/antigravity/brain/73e21b17-58d6-402b-b470-ba31f0a9e8c8/scratch/acopio.html', 'utf8');
const apiMatch = content.match(/const API\s*=\s*['"`]([^'"`]+)['"`]/);
const newsMatch = content.match(/const NEWS_API\s*=\s*['"`]([^'"`]+)['"`]/);
console.log('API:', apiMatch ? apiMatch[1] : 'Not Found');
console.log('NEWS:', newsMatch ? newsMatch[1] : 'Not Found');
