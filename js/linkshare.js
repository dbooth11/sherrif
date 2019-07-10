var db = null;
var data = null;
var tab = null;
var configdoc = "_local/config";
 config = null;
var replication = null;
var remoteCouch = 'http://192.168.1.131:5984/';

db = new PouchDB("linkshare");
db.get(configdoc).then(function (doc) {
    config = doc;
  }).catch(function (err) {
    alert(JSON.stringify(err));
  });

// MapReduce function that gets records for the current useremail
var map = function(doc) {
    emit(doc.recipient,config.useremail);
};

var loadLinks = function() {
  db.query(map, {include_docs:true}).then(function(result) {
    var html = '<tbody>';
    for(var i in result.rows) {
      var doc = result.rows[i].doc;
      html += '<tr>';
      if(doc.visited == 0){
      html += '<td class="green"><a class="truncate thelink" href="' + doc.url + '" title="' + doc.url + '" target="_new" data-from="' + doc.from +'"data-to="' + doc.recipient +'"data-id="' + doc._id +'" data-rev="' + doc._rev + '">' + doc.title + '</a><br />'
      }
      else{
      html += '<td><a class="truncate thelink" href="' + doc.url + '" title="' + doc.url + '" target="_new" data-from="' + doc.from +'" data-to="' + doc.recipient +'" data-id="' + doc._id +'" data-rev="' + doc._rev + '">' + doc.title + '</a><br />'
      }
      html += '</td>';
      html += '<td><button class="pseudo delete" data-id="' + doc._id +'" data-rev="' + doc._rev + '"><img src="img/remove.png" class="removeicon"/></button></td>'
      html += '</tr>';
    }
    html += '</tbody>';
    $('#thetable').html(html);

    // when the delete button is pressed
    $("button.delete").bind("click", function(event) {
      var b = $( this );
      var id = b.attr("data-id");
      var rev = b.attr("data-rev");
      db.remove(id,rev, function() {
        loadLinks();
      })
    });

    $("a.thelink").bind("click", function(event) {
      var d = $( this );
      var doc = {
        _id: d.attr("data-id"),
        _rev: d.attr("data-rev"),
        url: d.attr("href"),
        title: d.attr("title"),
        from: d.attr("data-from"),
        recipient: d.attr("data-to"),
        visited: 1
      }
      db.put(doc);
      loadLinks();
    });
  });
};

function saveLink() {
  chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
    tab = (tabs[0]);
    var doc = {
      url: tab.url,
      title: tab.title,
      from: config.useremail,
      recipient: config.recipientemail,
      visited: 0
    }
    document.getElementById('success').innerHTML = "Link sent!";
    db.post(doc);
  });
};

function kickOffReplication() {
  replication = db.sync(remoteCouch+"links", {live:true,retry:true});
}

loadLinks();
 
$("#save").bind("click", function() {
  alert("DD");
  saveLink();
});


$("#settingssave").bind("click", function() {
  if( $('#useremail').val() != config.useremail ) {
  config.username = $('#username').val();
  config.useremail = $('#useremail').val();
  db.put(config,callback);
  }
  kickOffReplication();
});

//load the config
//document.getElementById('#username').value(config.username);
//document.getElementById('#useremail').val(config.useremail);
