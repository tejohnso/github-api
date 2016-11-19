const https = require("https");

module.exports = function fetchDataAndHeaders(options) {
  return new Promise((res, rej)=>{
    console.log("fetching " + options.path);
    https.get((options), (resp)=>{
      let respText = "";

      if (resp.statusCode !== 200) {
        console.log(resp.headers);
        throw Error("HTTP Error: " + resp.statusCode);
      }

      resp.setEncoding("utf8");
      resp.on("data", data=>respText+=data);
      resp.on("end", ()=>{res({headers: resp.headers, data: respText});});
      resp.on("error", (e)=>{throw Error(e);});
    });
  });
}
