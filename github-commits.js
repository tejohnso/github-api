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
.then((result)=>{console.log(JSON.stringify(result, null, 2));})
.catch((err)=>{
  throw Error(err);
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

      resp.setEncoding("utf8");
      resp.on("data", data=>respText+=data);
      resp.on("end", ()=>{res({headers: resp.headers, data: respText});});
      resp.on("error", (e)=>{throw Error(e);});
    });
  });
}

function getPathFromLinkHeader(link, page) {
  return url.parse(link.split(", ").map(e=>e.split("; ")).filter(e=>e[1]===`rel="${page}"`)[0][0].slice(1, -1)).path;
  //'<https://api.github.com/user/1511535/events/public?page=2>; rel="next", <https://api.github.com/user/1511535/events/public?page=10>; rel="last"';
}

function iteratePrevPages(apiResponse, commitCount = 0, firstDate = new Date(), lastDate = new Date(0)) {
  let pushEvents = extractRecentPushEvents(apiResponse.data);
  commitCount += calculateCommitCount(pushEvents);
  [firstDate, lastDate] = updateFirstLastDates(pushEvents, firstDate, lastDate);

  if (!apiResponse.headers.link.includes('rel="prev"')) {
    return {commitCount, firstDate, lastDate};
  }

  return httpGet(Object.assign({}, options, {
    path: getPathFromLinkHeader(apiResponse.headers.link, "prev")
  }))
  .then((resp)=>iteratePrevPages(resp, commitCount, firstDate, lastDate));
}

function extractRecentPushEvents(data) {
  if (!data) {throw Error("no data");}
  data = JSON.parse(data);
  if (!data.length) {throw Error("invalid data");}

  return data.filter(e=>e.type === "PushEvent" && (new Date(e.created_at) >= tenDaysAgo));
}

function updateFirstLastDates(data, firstDate, lastDate) {
  data.forEach((e)=>{
    let eventCreated = new Date(e.created_at);
    firstDate = eventCreated < firstDate ? eventCreated : firstDate;
    lastDate = eventCreated > lastDate ? eventCreated : lastDate;
  });

  return [firstDate, lastDate];
}

function calculateCommitCount(data) {
  return data.reduce((sum, el)=>sum + el.payload.distinct_size, 0);
}
