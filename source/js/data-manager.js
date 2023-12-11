var DataManager = function(options) {
  this.options = _.defaults(options, {});

  this.defaultPage = 1;
  this.defaultPerPage = 2000;

  this.page = this.defaultPage;
  this.perPage = this.defaultPerPage;
  this.keyword = '';
  this.branchType = 'sale';

  this.init();
}

DataManager.prototype.getFetchUrl = function() {
  var self = this;

  return self.branchType == 'sale' ?
    'https://apis.data.go.kr/B190001/paperSale/sale' :
    'https://apis.data.go.kr/B190001/paperExchange/exchange';
}

DataManager.prototype.fetchData = async function() {
  var self = this;

  try {
    self.totalCount = 0;
    self.data = [];

    const res = await self.callAPI();
    self.appendData(res);
    self.aggregateSameLocationMap();

    return [ self.totalCount, self.data, self.dataMap ];
  } catch (e) {
    console.error(e);
  }
}

DataManager.prototype.callNextPage = async function() {
  var self = this;

  try {
    self.page++;

    const res = await self.callAPI();
    self.appendData(res);
    self.aggregateSameLocationMap();

    return [ self.totalCount, self.data, self.dataMap ];
  } catch (e) {
    console.error(e);
  }
}

DataManager.prototype.appendData = async function(res) {
  var self = this;

  self.totalCount = res.matchCount;
  self.data = self.data.concat(_.map(res.data, function(d) {
    var result = {
      id: `${d["brnch_id"]}`,
      distance: geoDistance(d["lat"], d["lot"], self.lat, self.lon),
      frcsAddr: nullToEmpty(d["brnch_addr"]),
      frcsDtlAddr: nullToEmpty(d["brnch_daddr"]),
      frcsNm: d["brnch_nm"],
      frcsRprsTelno: formatPhoneNumber(d["brnch_rprs_telno"]),
      fullAddress: `${nullToEmpty(d["brnch_addr"])} ${nullToEmpty(d["brnch_daddr"])}`,
      location: {lat: d["lat"], lon: d["lot"]}
    };

    return result;
  }));
  curCount = res.currentCount;

}

DataManager.prototype.callAPI = async function() {
  var self = this;

  var curCount = 0;

  // API 검색조건 설정: 자세한 호출방법은 https://www.data.go.kr/data/15119539/openapi.do 참고
  var requestJSON = {
    serviceKey: apiServiceKey,
    page: self.page,
    perPage: self.perPage,
  };
  if (self.keyword) requestJSON["cond[brnch_nm::LIKE]"] = self.keyword;
  if (usageRgnCd) requestJSON["cond[emd_cd::LIKE]"] = usageRgnCd;
  

  return new Promise( function (resolve, reject) {
    $.ajax({
      url: `${self.getFetchUrl()}?${new URLSearchParams(requestJSON).toString()}`,
      method: "GET",
      success: function(res) {
        resolve(res);
      },
      error: function(e) {
        alert("통신중 오류가 발생하였습니다.");
        reject(e);
      }
    });
  });
}



DataManager.prototype.setInitPage = function() {
  var self = this;

  self.page = self.defaultPage;
  self.perPage = self.defaultPerPage;
}

DataManager.prototype.setKeyword = function(keyword) {
  var self = this;

  self.keyword = keyword;
}

DataManager.prototype.setRelationType = function(relationType) {
  var self = this;

  self.relationType = relationType;
}

DataManager.prototype.setBranchType = function(branchType) {
  var self = this;

  self.branchType = branchType;
}

DataManager.prototype.setLocation = function(location) {
  var self = this;
  
  self.lat = location.lat;
  self.lon = location.lon;
}

DataManager.prototype.aggregateSameLocationMap = function() {
  var self = this;

  if (!self.data) return;

  var result = {};
  for (var datum of self.data) {
      if (!datum.location.lat || !datum.location.lon) continue;

      var key = `${datum.location.lat}_${datum.location.lon}`;
      if (!result[key]) {
          result[key] = [];
      }

      result[key].push(datum);
  }

  self.dataMap = result;
}

DataManager.prototype.getFranchiseById = function(id) {
  var self = this;

  var franchise = _.find(self.data, {'id': id});
  
  if (!franchise.stocks) {
    var requestJSON = {serviceKey: apiServiceKey, page: 1, perPage: 1000};
    requestJSON['cond[brnch_id::EQ]'] = id;

    $.ajax({
      url: `https://apis.data.go.kr/B190001/paperStock/stock?${new URLSearchParams(requestJSON).toString()}`,
      method: `GET`,
      async: false,
      success: function(res) {
        var stocks = [];
        _.forEach(res.data, function(d) {
          stocks.push({
            crtrYmd: d['crtr_ymd'],
            gtType: d['gt_type_dnmn'],
            gtQty: d['gt_type_stc_qty']
          });
        });
        stocks = _.sortBy(stocks, ['gtType']);
        franchise.stocks = stocks.reverse();
      },
      error: function(e) {
        console.error(e);
      }
    });
  }

  return franchise;
}



DataManager.prototype.init = function() {
  var self = this;

}