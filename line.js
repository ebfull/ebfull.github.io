fs = require('fs')

var peek = 35;


var retain = 0

var normal = []
var sybil = []
var selfish = []
var both = []

var dump = []

                var last = -1
                var cur = false
                var mode = false

parse = function(err, data) {
        if (err) return console.log(err)

        lines = data.split("\n")

        lines.forEach(function(line) {
                if (line[0] == "{") {
                        var p = JSON.parse(line)
                        if (typeof p.percent != "undefined") {
                                if (parseInt(Math.floor(parseFloat(p.percent))) != peek) {
                                        mode = dump;
                                        return;
                                }

                                if (p.attack && p.sybil) {
                                        mode = []
                                        both.push(mode)
                                } if (p.attack && !p.sybil) {
                                        mode = []
                                        selfish.push(mode)
                                } if (!p.attack && !p.sybil) {
                                        mode = []
                                        normal.push(mode)
                                } if (!p.attack && p.sybil) {
                                        mode = []
                                        sybil.push(mode)
                                }

                                cur = p;
                        } else if (typeof p.revenuePercent != "undefined") {
                                var revnow = Math.floor(parseFloat(p.revenuePercent)/100 * p.height)
                                mode.push([p.time, revnow])
                        }
                }
        })

        retain--;

        mode = false
        last = -1
        cur = false

        if (retain == 0) {
                console.log("var data = " + JSON.stringify(normal))
                console.log("var sybil = " + JSON.stringify(sybil))
                console.log("var selfish = " + JSON.stringify(selfish))
                console.log("var both = " + JSON.stringify(both))
        }
}

for (var i=1;i<50;i+=1) {
        retain++;
}

for (var i=1;i<50;i+=1) {
        fs.readFile('/home/ubuntu/sim'+i, 'utf8', parse)
}