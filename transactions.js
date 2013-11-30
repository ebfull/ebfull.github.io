function xor(a, b) {
	var n = "";

	for (var i=0;i<a.length;i++) {
		n += String.fromCharCode(a.charCodeAt(i) ^ b.charCodeAt(i));
	}

	return n;
}

function uid() {
	return (Math.floor((1 + Math.random()) * 0x10000)
             .toString(16)
             .substring(1)) + (Math.floor((1 + Math.random()) * 0x10000)
             .toString(16)
             .substring(1)) + (Math.floor((1 + Math.random()) * 0x10000)
             .toString(16)
             .substring(1));
}

/*
	Shared UTXO State System

	All nodes are initialized with the UTXO state of the network, which is blank.

	When a new transaction is applied, a new state object is created which references
	the previous state object as its 'parent'. A transformationMap entry is added so
	that transformations from the previous (parent) state, to the current state, can
	be found merely by identifying a unique state change ID, like a transaction hash.

	However, it's not just a transformation from the root state to a second state. If
	another state occurs on top of that state, it is also a transition from that state
	to
*/

/*
	TxIn object, has the same hash as the TxOut it references.
*/
function TxIn(prevtx, n) {
	// if prevtx is false, this is a coinbase input
	if (prevtx == false) {
		this.hash = uid();
        this.prevtxid = "x";
        this.n = -1;
	} else {
		var prevout = prevtx.outputs[n];

		this.hash = prevout.hash;
		this.prevtxid = prevout.intxid;
		this.n = prevout.n;
		this.__prev = prevtx; // MEMORY MANAGEMENT PURPOSES, NODE MUST NOT USE THIS TO ITS ADVANTAGE!
	}
}

/*
	TxOut object, has the same hash as any TxIn that spends it.
*/
function TxOut(intx, n) {
	this.hash = uid();
    this.intxid = intx.id;
    this.n = n;
    this.__in = intx;
}

/*
	Transaction object.

	TODO: make transaction constructor require outputs to be specified

	Currently just creates an arbitrary number of outputs. There is, obviously,
	no authentication or scripting.
*/
function Transaction(inputs) {
	this.id = uid();
    this.outputs = [];

    var no = Math.floor(Math.random() * 2) + 1;

    for (var i=0;i<no;i++) {
    	this.outputs.push(new TxOut(this, i));
    }

    this.inputs = inputs;
    this.coinbase = false;

    this.getInputs = function() {
    	var foo = {};

    	this.inputs.forEach(function(i) {
    		foo[i.hash] = i;
    	})

    	return foo;
    }

    this.getOutputs = function() {
    	var foo = {};

    	this.outputs.forEach(function(o) {
    		foo[o.hash] = o;
    	})

    	return foo;
    }
}

function UTXOStateValidation(state, extra) {
	this.state = state;
	this.extra = extra;
}

UTXOStateValidation.CONFLICT = 1;
UTXOStateValidation.ORPHAN = 2;
UTXOStateValidation.VALID = 3;
UTXOStateValidation.DUPLICATE = 4;

function UTXOState(parent, tx) {
	if (typeof parent == "undefined") {
		parent = false;
		this.id = uid();
		this.root = this;
	} else {
		this.id = xor(parent.id, tx.id);
		this.root = parent.root;
		parent.children.push(this)
	}

	if (typeof tx != "undefined") {
		this.tx = [tx];
		this.spents = tx.getInputs()
		this.unspents = tx.getOutputs()
	} else {
		this.tx = [];
		this.spents = {};
		this.unspents = {};
	}
	this.parent = parent;
	this.cache = {};
	this.children = [];
	this.retain = 0;
}

UTXOState.prototype = {
	add: function(tx, validation) {
		if (validation.state == UTXOStateValidation.VALID) {
			if (typeof this.root.cache[xor(this.id, tx.id)] != "undefined") {
				return this.root.cache[xor(this.id, tx.id)] // someone already met this state
			}
			var n;
			this.root.cache[xor(this.id, tx.id)] = n = new UTXOState(this, tx);

			return n;
		}

		return this;
	},
	remove: function(tx) {
		// unwinds the current state until the transaction is removed, returns all casualty transactions
		var cur = this;
		var casualties = [];

		while(cur) {
			var cont = true;

			for (var i=cur.tx.length-1;i>=0;i--) {
				if (cur.tx[i] == tx)
					cont = false;
				else
					casualties.unshift(tx)
			}

			if (cont)
				cur = cur.parent;
			else
				break;
		}

		return {casualties:casualties,state:cur}
	},
	verify: function(tx) {
		var cur = this;
		var inputsNotFound = tx.getInputs();

		var firstQualified = false;

		while (cur) {
			if (inputsNotFound.length == 0)
				break;

			for (var i in inputsNotFound) {
				if (cur.tx.indexOf(tx) != -1)
					return new UTXOStateValidation(UTXOStateValidation.DUPLICATE, cur) // return the current state position where the conflict occurred

				if (typeof cur.unspents[i] != "undefined") {
					// found one of the inputs
					delete inputsNotFound[i];

					if (!firstQualified)
						firstQualified = cur;
				}

				if (typeof cur.spents[i] != "undefined") {
					// this should not have been spent by any other transaction
					return new UTXOStateValidation(UTXOStateValidation.CONFLICT, cur) // return the current state position where the conflict occurred
					break;
				}
			}

			cur = cur.parent;
		}

		// are there still inputs we haven't found
		if (inputsNotFound.length) {
			// if it's a coinbase tx, it doesn't matter
			if (!tx.coinbase)
				return new UTXOStateValidation(UTXOStateValidation.ORPHAN, inputsNotFound)
		}

		return new UTXOStateValidation(UTXOStateValidation.VALID, firstQualified) // return the first qualified state where the transition can occur (the last looped)
	},
	retain: function() {
		this.retain++;
	},
	release: function() {
		this.retain--;

		if (this.retain == 0) {
			// nothing can transition to this state now
			delete this.root.cache[this.id]

			// collapse into our children
			for (var i=0;i<this.children;i++) {
				for (var spend in this.spents) {
					this.children[i].spents[spend] = this.spents[spend]
				}
				for (var unspend in this.unspents) {
					this.children[i].unspents[unspend] = this.unspents[unspend]
				}
				for (var t=0;t<this.tx.length;t++) {
					this.children[i].tx.unshift(this.tx[t])
				}
				this.children[i].parent = this.parent;
			}
		}
	}
}

function Transactions(self) {
	self.utxo = new ObjectCollection(self.network.shared("utxo", UTXOState));
	self.utxo.retain();

	this.add = function(tx) {
		var v = self.utxo.verify(tx)

		switch (v.state) {
			case UTXOStateValidation.VALID:
				// The transaction is valid. We can run add on UTXO now.
			break;
			case UTXOStateValidation.ORPHAN:
				// The transaction is an orphan, because some of its inputs are missing.
			break;
			case UTXOStateValidation.CONFLICT:
				// The transaction conflicts with a previous transaction.
			break;
			case UTXOStateValidation.DUPLICATE:
				// The transaction already appears in the UTXO.
			break;
		}
	}

	this.remove = function(tx) {
		
	}
}

