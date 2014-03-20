fs = require('fs')

// i use this to parse results from sim.js and place it into scatter.html

var retain = 0

var normal = []
var sybil = []
var selfish = []
var both = []

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
                                if (last >= 0) {
                                       mode.push([parseFloat(cur.percent), parseFloat(last)])
                                }

                                if (p.attack && p.sybil)
                                        mode = both
                                if (p.attack && !p.sybil)
                                        mode = selfish
                                if (!p.attack && !p.sybil)
                                        mode = normal
                                if (!p.attack && p.sybil)
                                        mode = sybil

                                cur = p;
                        } else {
                                last = p.averageRevPerHour;
                        }
                }
        })

        mode.push([Math.round(parseFloat(cur.percent)), parseFloat(last)])

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

var sims = fs.readdirSync("/home/ubuntu/")

sims.forEach(function(f) {
    if (f.match(/^sim/)) {
        retain++;
    }
})

sims.forEach(function(f) {
    if (f.match(/^sim/)) {
        fs.readFile('/home/ubuntu/'+f, 'utf8', parse)
    }
})
