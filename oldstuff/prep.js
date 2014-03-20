fs = require('fs')

var sim = process.argv[2]

fs.readFile(sim, 'utf8', function(err, gg) {
        if(err)return console.log(err)
        var include = /'include (.+)';/g;
        var match;
        var data = ""+gg;
        var orig = ""+data;

        while ((match = include.exec(orig)) != null) {
                var filename = match[1] // filename
                console.log("replacing " + filename)

                inc = fs.readFileSync(filename, 'utf8');
                data = data.replace("'include " + filename + "';", inc)
                fs.writeFileSync(sim, data)
        }
})