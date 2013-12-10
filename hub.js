// hub script for dispatching simulation tasks to lots of servers

var async = require('async')
var sys = require('sys')

var exec = require('child_process').exec;

// todo just in case
var escapeshell = function(cmd) {
        return '"'+cmd+'"';
};

function runRemoteCommand(host, cmd, out, cb) {
        var r = Math.floor(Math.random() * 100000000)
        var f;
        if (out)
                f = "ssh -o \"StrictHostKeyChecking no\" ubuntu@" + host + " " + escapeshell(cmd) + " > " + (out+"-"+r)
        else
                f = "ssh -o \"StrictHostKeyChecking no\" ubuntu@" + host + " " + escapeshell(cmd);

        exec(f, function(err, stdout, stderr) {
                cb(null, null)
        })
}


/////////////////////////////////////////////////////////////

hosts = [
        ["ec2-23-20-236-89.compute-1.amazonaws.com", 55],
        ["ec2-54-211-122-145.compute-1.amazonaws.com", 55],
        ["ec2-54-196-124-111.compute-1.amazonaws.com", 55],
        ["ec2-54-204-193-78.compute-1.amazonaws.com", 55],
        ["ec2-107-22-127-24.compute-1.amazonaws.com", 28],
        ["ec2-54-234-223-206.compute-1.amazonaws.com", 28],
        ["ec2-54-196-12-230.compute-1.amazonaws.com", 14],
        ["ec2-54-196-118-231.compute-1.amazonaws.com", 14],
        ["ec2-54-196-102-209.compute-1.amazonaws.com", 14],
        ["ec2-54-196-164-68.compute-1.amazonaws.com", 14],
        ["ec2-54-196-42-132.compute-1.amazonaws.com", 20],
        ["ec2-23-20-159-119.compute-1.amazonaws.com", 20],
        ["ec2-50-17-121-194.compute-1.amazonaws.com", 20],
        ["ec2-54-227-147-32.compute-1.amazonaws.com", 20],
        ["ec2-54-224-7-20.compute-1.amazonaws.com", 20],
        ["ec2-54-196-173-50.compute-1.amazonaws.com", 20],
        ["ec2-54-224-166-178.compute-1.amazonaws.com", 20],
        ["ec2-50-17-65-148.compute-1.amazonaws.com", 20],
        ["ec2-54-196-99-140.compute-1.amazonaws.com", 20]
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
                        runRemoteCommand(server[0], task[0], task[1], taskDone);
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

}

/////////////////////////////////////////////////////////////

var provision = async.queue(function(host, cb) {
        console.log("(" + host + ") provisioning")

        runRemoteCommand(host, "echo -e 'MaxSessions 1000\\nMaxStartups 1000\\n' | sudo tee -a /etc/ssh/sshd_config; sudo service sshd restart", false, function() {
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