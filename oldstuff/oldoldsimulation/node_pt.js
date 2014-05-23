Node.prototype.__tick = function(from, msg) {
	if (this.peers.amt < 8) {
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

	//this.mine(-1, {});
	this.parent.run(-1, this.id, 1000, '__tick', {});
}

Node.prototype.__deconstruct = function(from, msg) {
	this.peers.all(function(node, p){
		node.parent.run(node.id, p, 0, 'disconnect', true);
		node.disconnect(p, false);
	});
	this.parent.network.removeNode(this.parent.get(this.id).networkid);
	delete this.parent.nodes[this.id].actor;
}