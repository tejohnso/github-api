const https = require("https");
const url = require("url");
const tenDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 10;

const options = {
  hostname: "api.github.com",
  path: "/users/tejohnso/events/public",
  headers: {
    "Authorization": "token " + process.env.GITHUB_TOKEN,
    "user-agent": "nodejs",
    "accept": "application/vnd.github.v3+json"
  }
};

if (!process.env.GITHUB_TOKEN) {delete options.headers.Authorization;}

httpGet(Object.assign({}, options, {method: "HEAD"}))
.then(function lastPageFromHeadRequest(resp) {
  return httpGet(Object.assign({}, options, {path: getPathFromLinkHeader(resp.headers.link, "last")}));
})
.then(iteratePrevPages)
.then((result)=>{console.log(result);})
.catch((err)=>{
  require("util").inspect(err);
});

function httpGet(options) {
  return new Promise((res, rej)=>{
    console.log("fetching " + options.path);
    https.get((options), (resp)=>{
      let respText = "";

      if (resp.statusCode !== 200) {
        console.log(resp.headers);
        throw Error("HTTP Error: " + resp.statusCode);
      }

      resp.on("data", data=>respText+=data.toString());
      resp.on("end", ()=>{res({headers: resp.headers, data: respText});});
      resp.on("error", (e)=>{require("util").inspect(e);});
    });
  });
}

function getPathFromLinkHeader(link, page) {
  return url.parse(link.split(", ").map(e=>e.split("; ")).filter(e=>e[1]===`rel="${page}"`)[0][0].slice(1, -1)).path;
  //'<https://api.github.com/user/1511535/events/public?page=2>; rel="next", <https://api.github.com/user/1511535/events/public?page=10>; rel="last"';
}

function iteratePrevPages(resp, commitCount = 0, firstDate = new Date(), lastDate = new Date(0)) {
  let dataResult = parseAPIData(resp.data);
  commitCount += dataResult.commitCount;
  lastDate = dataResult.lastDate;
  firstDate = dataResult.firstDate;

  if (resp.headers.link.includes('rel="prev"')) {
    return httpGet(Object.assign({}, options, {path: getPathFromLinkHeader(resp.headers.link, "prev")}))
    .then((resp)=>iteratePrevPages(resp, commitCount, firstDate, lastDate));
  } else {
    return {commitCount, firstDate, lastDate};
  }
}

function parseAPIData(data, firstDate, lastDate) {
  if (!data) {throw Error("no data");}
  data = JSON.parse(data);
  if (!data.length) {throw Error("invalid data");}

  data = data.filter(e=>e.type === "PushEvent" && (new Date(e.created_at) >= tenDaysAgo));
  //data.forEach(e=>console.log(e.created_at, e.type));
  data.forEach((e)=>{
    let eventCreated = new Date(e.created_at);
    firstDate = firstDate < eventCreated ? firstDate : eventCreated;
    lastDate = lastDate > eventCreated ? lastDate : eventCreated;
  });

  return {
    commitCount: data.reduce((sum, el)=>sum + el.payload.distinct_size, 0),
    firstDate,
    lastDate
  };
}
