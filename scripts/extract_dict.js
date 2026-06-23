const fs = require('fs');
const content = fs.readFileSync('node_modules/js-aruco2/src/dictionaries/aruco_5x5_1000.js', 'utf8');
const match = content.match(/AR\.DICTIONARIES\['ARUCO_5X5_1000'\] = (\{[\s\S]*?\});/);
if (match) {
  let json = match[1]
    .replace(/'/g, '"')
    .replace(/(\w+):/g, '"$1":')
    .replace(/,\s*([}\]])/g, '$1');
  const dictObj = JSON.parse(json);
  console.log('nBits:', dictObj.nBits);
  console.log('tau:', dictObj.tau);
  console.log('codeList length:', dictObj.codeList.length);
  console.log('First entry:', JSON.stringify(dictObj.codeList[0]));
  console.log('Last entry:', JSON.stringify(dictObj.codeList[dictObj.codeList.length - 1]));
  fs.writeFileSync('_dict_5x5_1000.json', JSON.stringify(dictObj, null, 2));
  console.log('Dictionary saved to _dict_5x5_1000.json');
} else {
  console.log('No match found');
  console.log('First 300 chars:', content.substring(0, 300));
}
