function Transaction(inputs, outputs) {
	this.inputs = [];
	this.outputs = [];

	inputs.forEach(function(input) {
		this.inputs.push({id:input})
	}, this)

	outputs.forEach(function(output) {
		this.outputs.push({id:output})
	}, this)

	this.id = ConsensusState.prototype.rand();
}

Transaction.prototype = {
	neverspent: function(tr, v, bucket) {
		if (!tr)
			return true; // return true to tell the validator that we didn't see this output spent anywhere else, which is good

		return tr.inputs.some(function(input) {
			if (input.id == bucket) {
				v.state = v.CONFLICT;
				v.conflict = tr;
				return true;
			}
		}, this)
	},
	unspent: function(tr, v, bucket) {
		if (!tr)
			return false; // return false to tell the validator that we needed to see this unspent output, and we didn't

		return tr.outputs.some(function(output) {
			if (output.id == bucket) {
				return true;
			}
		})
	},
	dontspend: function(tr, v, bucket) {
		if (!tr)
			return true; // good, it wasn't spent by anything

		tr.inputs.some(function(input) {
			if (input.id == bucket) {
				tr.invalidate(v)
			}
		})
	},
	invalidate: function(v) {
		if (v.unapplies.indexOf(this) != -1)
			return;

		v.unapplies.push(this)

		// anything which spends our outputs should be removed
		this.outputs.forEach(function(output) {
			v.check(output.id, this.dontspend)
		}, this)
	},
	validate: function(v) {
		if (v.applies.indexOf(this) != -1)
			return;

		v.applies.push(this)

		this.inputs.forEach(function(input) {
			v.check(input.id, this.unspent)
			v.check(input.id, this.neverspent)
		}, this)
	},
	apply: function(s) {
		// attach this transition to all buckets which it influences

		this.inputs.forEach(function(input) {
			s.attach(input.id, this)
		}, this)

		this.outputs.forEach(function(output) {
			s.attach(output.id, this)
		}, this)
	}
}

Transaction.prototype.__proto__ = ConsensusTransitionPrototype;

// no more fetch collapse

function Transactions(self) {
	self.mempool = this;
	this.utxo = self.network.shared("utxo")
	this.utxo.retain()

	this.addTransaction = function(tx, force) {
		var val = this.utxo.validate(tx)
		if (val.state == val.VALID) {
			this.utxo = this.utxo.shift(val)
			return true;
		} else if (val.state == val.CONFLICT) {
			if (force) {
				var inval = this.utxo.invalidate(val.conflict)
				this.utxo.shift(inval)

				return this.addTransaction(tx, force) // try adding again, recursively until it works
			}
			return true;
		}

		return false;
	}

	this.createRandomOutputs = function(amt) {
		var results = [];

		while (results.length < amt) {
			results.push(ConsensusState.prototype.rand());
		}

		return results;
	}

	this.getRandomInputs = function(amt) {
		// collapse the UTXO
		var collapse = Object.keys(this.utxo.fetch(new FetchCollapse(), "collapse").unspent);

		var results = [];

		while (results.length < amt) {
			if (!collapse.length)
				break;

			var r = collapse[Math.floor(Math.random() * collapse.length)]

			results.push(r)
			collapse.splice(collapse.indexOf(r), 1)
		}

		return results;
	}

	// TODO: ???
	this.createTransaction = function() {
		//var inputs = this.getRandomInputs(Math.floor(Math.random() * 2) + 1)
		var inputs = [];
		var outputs = this.createRandomOutputs(Math.floor(Math.random() * 2) + 1)

		var tx = new Transaction(inputs, outputs)

		this.addTransaction(tx)

		// add to inventory
		self.inventory.createObj("tx", {name:tx.id,tx:tx})
	}

	self.on("inv:tx", function(from, inv) {
		this.addTransaction(inv.obj.tx)
	}, this)
}

