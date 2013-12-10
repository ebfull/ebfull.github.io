// node.js simulator
// uses command argument to get percentage we want to simulater

require('./goog/bootstrap/nodejs')
goog.require("goog.structs.PriorityQueue")

// these can be replaced with `node prep.js sim.js`
'include network.js';
'include peermgr.js';
'include inventory.js';
'include blockchain.js';
'include miner.js';

var net;
var btc;
var interval = 1000 * 60 * 60; // 1 hour

var targetHeight = 10000;
var numNodes = 1000;

var trials = []

var p = parseFloat(process.argv[2])

if (process.argv[3] == "normal")
        trials.push({percent:p, sybil: false, attack: false})
if (process.argv[3] == "sybil")
        trials.push({percent:p, sybil: true, attack: false})
if (process.argv[3] == "selfish")
        trials.push({percent:p, sybil: false, attack: true})
if (process.argv[3] == "both")
        trials.push({percent:p, sybil: true, attack: true})

function start(percent, sybil, attack) {
        console.log(JSON.stringify({percent:percent*100,sybil:sybil,attack:attack}))
        var allpercent = 1;
        btc = new Node();

        btc.use(PeerMgr);
        btc.use(Inventory);
        btc.use(Blockchain);
        btc.use(Miner);

        btc.init(function() {
                if(this.id == 0) {
                        this.mine(percent)
                        allpercent-=percent;
                        if (attack)
                                this.attack()
                        if (sybil)
                                this.peers.maxpeers = numNodes - 1;
                }
                else {
                        var thispercent = Math.random() * (allpercent * 0.3)
                        allpercent -= thispercent;
                        this.mine(thispercent)
                }
        })

        net = new Network()
        net.add(numNodes, btc)
}

var curtrial;
while (curtrial = trials.shift()) {
        start(curtrial.percent, curtrial.sybil, curtrial.attack);

        while(true) {
                net.run(interval) // run 100 seconds
                var total = 0;
                var my = 0;
                var cur = net.nodes[99].blockchain.chainstate.head;
                while (cur) {
                        if (cur.credit === 0)
                                my++;
                        total++;
                        cur = cur._prev();
                }
                var pub = net.nodes[0].blockchain.chainstate.head.h;
                var lol = 0;
                if (typeof net.nodes[0].private_blockchain != "undefined")
                        lol = net.nodes[0].private_blockchain.chainstate.head.h;

                var revPerHour = ((my / (net.now/(1000*60*60)))).toFixed(2)

                if (total > 0)
                        console.log(JSON.stringify({time:net.now,height:pub,revenuePercent:((my/total)*100).toFixed(2),averageRevPerHour:revPerHour}));

                if (pub >= targetHeight) {
                        break;
                }
        }
}