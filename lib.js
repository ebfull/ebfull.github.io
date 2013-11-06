function PeerMgr(node) {
	this.peers = {};
	this.amt = 0;
	this.statusCallback = null;


	this.exists = function(p) {
		if (this.peers.hasOwnProperty(p))
			return true;

		return false;
	}

	this.add = function(p) {
		if (this.amt>=8)
			return false; // already enough peers

		p = parseInt(p);

		if (this.exists(p))
			return false; // already connected

		if(node.id==0)
			node.parent.con++;

		this.amt += 1;
		this.peers[p] = {};
		node.parent.connect(node.id, p);

		return true;
	}

	this.set = function(p, status) {
		if (!this.peers.hasOwnProperty(p))
			return -1;
		else
			this.peers[p] = status;
	}

	this.get = function(p) {
		if (!this.peers.hasOwnProperty(p))
			return -1;
		else
			return this.peers[p];
	}

	this.random = function() {
		var result;
	    var count = 0;
	    for (var prop in this.peers)
	        if (Math.random() < 1/++count)
	           result = prop;
	    return parseInt(result);
	}

	this.remove = function(p) {
		p = parseInt(p);

		if(node.id==0)
			node.parent.con--;

		if (!this.peers.hasOwnProperty(p))
			return false;

		this.amt -= 1;
		delete this.peers[p];
		node.parent.disconnect(node.id, p);

		return true;
	}

	this.all = function(func) {
		for (var id in this.peers) {
			id = parseInt(id);
			func(node, id);
		}
	}
};

function Blockchain(node) {
	this.h = 1;
	this.color = "black";
	this.revenue = {};

	this.height = function() {
		return this.h;
	}

	this.chainstate = function() {
		return {height:this.h,color:this.color,revenue:this.revenue};
	}

	this.newstate = function(msg) {
		this.h = msg.height;
		this.color = msg.color;
		this.revenue = jQuery.extend(true, {}, msg.revenue); // is cloning really this retarded in js?
	}

	this.mined = function() {
		this.h+=1;

		this.color = node.color;
		if (typeof this.revenue[node.id] == "undefined") {
			this.revenue[node.id] = 0
		}
		this.revenue[node.id]+=1;
	}
};