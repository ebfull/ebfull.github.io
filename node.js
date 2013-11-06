function Node(id, parent) {
	this.id = id;
	this.parent = parent;
	this.nodeArchive = [0];
	this.lock = false;
	this.npass = 0;

	this.maxpeers = 20;

	// modules
	this.peers = new PeerMgr(this);
	this.chain = new Blockchain();

	this.tick = function(from, msg) {
		if (this.peers.amt < this.maxpeers) {
			// we don't have eight peers
			// let's try connecting to a known peer

			var r = this.nodeArchive[this.npass % this.nodeArchive.length];
			this.npass++;

			if (r != this.id && (typeof(r) != 'undefined')) // we don't want to connect to ourself!
				this.parent.run(this.id, r, 0, 'connect', this._getStatus());

			// and to get more known peers
			this.peers.all(function(node, p){
				//console.log(node.id + ' trying getpeer to ' + p);
				node.parent.run(node.id, p, 0, 'getpeer', {});
			});
		}

		this.mine(-1, {});
		this.parent.run(-1, this.id, 1000, 'tick', {});
	}

	this.mine = function(from, msg) {
		if (Math.random() > 0.995) {
			this.chain.h++;

			// tell our other nodes what our new status is
			this._broadcastStatus();
		}
	}

	/*
		returns the current status of the local node
	*/
	this._getStatus = function() {
		return {height:this.chain.height()};
	}

	/*
		sets the status of the local node and broadcasts it
	*/
	this._broadcastStatus = function() {
		// let's update our color to reflect the new status
		var colors = ["red", "blue", "green", "purple", "orange"];
		this.parent.setColor(this.id, colors[this._getStatus().height % colors.length]);

		this.peers.all(function(node, p){
			//console.log(node.id + ' trying getpeer to ' + p);
			node.parent.run(node.id, p, 0, 'newStatus', node._getStatus());
		});
	}

	this.sendpeer = function(from, peers) {
		// let's add peer to our local nodeArchive
		// at the beginning
		// and then reset npass
		for (var i=0;i<peers.length;i++) {
			var peer = peers[i];

			if (isNaN(peer))
				continue;

			if (this.nodeArchive.indexOf(peer) < 0) {
				this.nodeArchive.unshift(peer);
				this.npass = 0;
			}
		}
	}

	this.getpeer = function(from, msg) {
		// give the peer a random node from our peer list and our full nodeArchive
		var tries = 0;
		r = this.peers.random();
		while ((r == from) && (tries < 5)) {
			r = this.peers.random();
			tries++;
		}
		this.parent.run(this.id, from, 0, 'sendpeer', [r].concat(this.nodeArchive));
	}

	this.accept = function(from, msg) {
		if (this.peers.add(from)) {
			var index = this.nodeArchive.indexOf(from);
			if (index != -1)
				this.nodeArchive.splice(index, 1);

			// the height of the remote node may be higher than ours
			this.peers.set(from, msg); // set the new status of the remote node

			if (msg.height > this._getStatus().height) {
				this.chain.h = msg.height;
				this._broadcastStatus();
			}
		} else {
			// tell them nope
			this.getpeer(from, {});
			this.parent.run(this.id, from, 0, 'disconnect', true);
		}
	}

	this.deconstruct = function(from, msg) {
		this.peers.all(function(node, p){
			node.parent.run(node.id, p, 0, 'disconnect', true);
			node.disconnect(p, false);
		});
		this.parent.network.removeNode(this.parent.get(this.id).networkid);
		delete this.parent.nodes[this.id].actor;
	}

	this.newStatus = function(from, msg) {
		this.peers.set(from, msg); // set the new status of the remote node

		if (msg.height > this._getStatus().height) {
			this.chain.h = msg.height;
			this._broadcastStatus();
		}
	}

	this.connect = function(from, msg) {
		if (this.peers.exists(from))
			return false; // leave me alone, i'm already connected to you

		if (this.peers.amt < this.maxpeers) {
			// we need this peer, let's accept
			this.parent.run(this.id, from, 0, 'accept', this._getStatus());
			this.accept(from, msg);
		} else if (this.peers.amt >= this.maxpeers) {
			// disconnect a random peer
			var r = this.peers.random();
			this.getpeer(r, {});
			this.parent.run(this.id, r, 0, 'disconnect', true);
			this.disconnect(r, false);

			// accept the new peer
			this.parent.run(this.id, from, 0, 'accept', this._getStatus());
			this.accept(from, msg);
		} else {
			// just reject and give a random peer we have
			this.getpeer(from, {});
		}
	}
	
	this.disconnect = function(from, msg) {
		if (this.nodeArchive.indexOf(from) < 0)
			this.nodeArchive.push(from);

		this.peers.remove(from);
	}
};

