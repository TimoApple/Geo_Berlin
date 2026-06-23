const fs = require('fs');
const content = fs.readFileSync('node_modules/js-aruco2/src/dictionaries/aruco_5x5_1000.js', 'utf8');
const match = content.match(/AR\.DICTIONARIES\['ARUCO_5X5_1000'\] = (\{[\s\S]*?\});/);
if (!match) {
  console.error('No match found');
  process.exit(1);
}

// Parse the dictionary
let json = match[1]
  .replace(/'/g, '"')
  .replace(/(\w+):/g, '"$1":')
  .replace(/,\s*([}\]])/g, '$1');
const dictObj = JSON.parse(json);

// Generate the codeList as a compact JS array
const entries = dictObj.codeList.map((arr) => '[' + arr.join(',') + ']');
const codeListStr = '[' + entries.join(',') + ']';

const output = `  ARUCO_5X5_1000: {
    nBits: ${dictObj.nBits},
    tau: ${dictObj.tau},
    codeList: ${codeListStr}
  }`;

fs.writeFileSync('_dict_output.txt', output);
console.log('Generated dictionary output to _dict_output.txt');
console.log('codeList length:', dictObj.codeList.length);
