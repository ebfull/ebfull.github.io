/*
The PeerMgr middleware enables nodes to communicate through network message events.

It first attempts to bootstrap from the 0th node, to learn of other nodes.

*/

function PeerState(id, lastmessage) {
	this.id = id;
	this.lastmessage = lastmessage;
	this.active = false;
}

// checkpoint

function PeerMgr(node) {
	node.init(function(self) {
		self.peers = {};
		self.numpeers = 0;
		self.maxpeers = 10;
		self.nodearchive = [new PeerState(0, self.now())];
	});

	node.on("connect", function(self, from, msg) {
		if (self.numpeers < self.maxpeers) {
			if (typeof self.peers[from] != "undefined")
				return false; // already connected to you...?

			// accept
			self.send(from, "accept")
			self.peers[from] = new PeerState(from, self.now());
			self.peers[from].active = true;
		} else {
			// reject
			self.send(from, "reject", self.nodearchive.slice())
		}
	})

	node.on("accept", function(self, from, msg) {
		if (typeof self.peers[from] == "undefined")
			return false; // we didn't make a connection attempt

		self.peers[from].active = true;
	})

	var seekPeers = function(self) {
		if (self.numpeers < self.maxpeers) {

			if (self.nodearchive.length) {
				var to = self.nodearchive.shift();

				if (typeof self.peers[to.id] == "undefined") {
					self.numpeers++;
					self.peers[to.id] = to;

					self.send(to.id, "connect")
				}
			}

			if (Object.keys(self.peers).length) {
				var randomPeer = self.peers[Object.keys(self.peers)[Math.floor(Math.random() * Object.keys(self.peers).length)]]

				if (randomPeer.active) {

				}
			}

		} else {
			return false; // we don't need to tick anymore
		}
	};

	node.tick(100, seekPeers)
}