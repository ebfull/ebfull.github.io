// hub script for dispatching simulation tasks to lots of servers

var async = require('async')
var sys = require('sys')

var exec = require('child_process').exec;

// todo just in case
var escapeshell = function(cmd) {
        return '"'+cmd+'"';
};

function runRemoteCommand(host, cmd, out, cb, pr) {
        var r = Math.floor(Math.random() * 100000000)
        var f;
        if (out)
                f = "ssh -o \"StrictHostKeyChecking no\" ubuntu@" + host + " " + escapeshell(cmd) + " > " + (out+"-"+r)
        else
                f = "ssh -o \"StrictHostKeyChecking no\" ubuntu@" + host + " " + escapeshell(cmd);

        exec(f, function(err, stdout, stderr) {
                if (err)
                        console.log(err)

                if (typeof pr != "undefined")
                        process.stderr.write(stdout)

                cb(null, null)
        })
}


/////////////////////////////////////////////////////////////

hosts = [
        ["ec2-54-211-225-96.compute-1.amazonaws.com", 20],
        ["ec2-54-211-27-200.compute-1.amazonaws.com", 20],
        ["ec2-54-204-233-65.compute-1.amazonaws.com", 20],
        ["ec2-23-20-252-194.compute-1.amazonaws.com", 20],
        ["ec2-54-242-121-7.compute-1.amazonaws.com", 20],
        ["ec2-54-196-64-189.compute-1.amazonaws.com", 20],
        ["ec2-54-205-166-174.compute-1.amazonaws.com", 20],
        ["ec2-50-16-87-43.compute-1.amazonaws.com", 20],
        ["ec2-54-204-62-49.compute-1.amazonaws.com", 20],
        ["ec2-54-237-6-34.compute-1.amazonaws.com", 20],
        ["ec2-54-227-70-8.compute-1.amazonaws.com", 20],
        ["ec2-54-221-140-196.compute-1.amazonaws.com", 20],
        ["ec2-54-196-186-112.compute-1.amazonaws.com", 20],
        ["ec2-54-205-216-166.compute-1.amazonaws.com", 20],
        ["ec2-23-20-245-38.compute-1.amazonaws.com", 20],
        ["ec2-107-20-122-92.compute-1.amazonaws.com", 20],
        ["ec2-54-237-2-170.compute-1.amazonaws.com", 20],
        ["ec2-107-20-94-82.compute-1.amazonaws.com", 20],
        ["ec2-54-196-92-51.compute-1.amazonaws.com", 20],
]


tasks = []

for (var i=0;i<50;i++) {
        // every percent less than 50
        for (var t=0;t<3;t++) {
                // 3 trials of each
                tasks.push(["cd ebfull.github.io && node sim.js " + (i/100).toFixed(2) + " normal", "/home/ubuntu/sim"+i])
                tasks.push(["cd ebfull.github.io && node sim.js " + (i/100).toFixed(2) + " sybil", "/home/ubuntu/sim"+i])
                tasks.push(["cd ebfull.github.io && node sim.js " + (i/100).toFixed(2) + " selfish", "/home/ubuntu/sim"+i])
                tasks.push(["cd ebfull.github.io && node sim.js " + (i/100).toFixed(2) + " both", "/home/ubuntu/sim"+i])
        }
}

/////////////////////////////////////////////////////////////

function doStuff() {

        var workers = async.queue(function(arg, cb) {
                var server = arg.server;

                var q = async.queue(function(nope, doneWithTasks) {
                        var task;

                        async.whilst(function() {return task = tasks.shift();}, function(taskDone) {
                                console.log("dispatch (" + server[0] + "): " + task[0])
                                runRemoteCommand(server[0], task[0], task[1], function() {
                                        console.log("completed (" + server[0] + "): " + task[0])
                                        taskDone()
                                });
                        }, doneWithTasks);
                }, server[1])

                q.drain = function() {
                        cb();
                }

                for (var i=0;i<server[1];i++) {
                        q.push("nope")
                }
        }, hosts.length)

        hosts.forEach(function(host) {
                workers.push({server:host})
        })

        setInterval(function() {
                // get stats for our workers
                process.stderr.write("-----------------------\n")
                hosts.forEach(function(host) {
                        process.stderr.write("(" + host[0] + ") ")
                        runRemoteCommand(host[0], "uptime", false, function() {}, true)
                })
        }, 30 * 1000)
}

/////////////////////////////////////////////////////////////

var provision = async.queue(function(host, cb) {
        console.log("(" + host + ") provisioning")

        runRemoteCommand(host, "echo -e '\\nMaxSessions 1000\\nMaxStartups 1000\\n' | sudo tee -a /etc/ssh/sshd_config; sudo service ssh restart", false, function() {
                runRemoteCommand(host, "ps aux | grep -ie sim.js | awk '{print \\$2}' | xargs kill -9", false, function() {
                        runRemoteCommand(host, "rm -rf ebfull.github.io; git clone https://github.com/ebfull/ebfull.github.io.git", false, function() {
                                runRemoteCommand(host, "cd ebfull.github.io; node prep.js sim.js", false, function() {
                                        console.log("(" + host + ") done provisioning");
                                        cb();
                                })
                        })
                });
        });
}, hosts.length);

provision.drain = function() {
        doStuff();
}

hosts.forEach(function(h) {
        provision.push(h[0])
})