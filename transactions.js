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
	validate: function(v) {
		v.applies.push(this)

		// ensure that all inputs are unspent
		this.inputs.forEach(function(input) {
			v.is(input.id, function(prev) {return true;})
		})
	},
	apply: function(s) {
		// remove our inputs from the UTXO
		this.inputs.forEach(function(input) {
			s.undo(input.id, this)
		}, this)

		// add our outputs to the UTXO
		this.outputs.forEach(function(output) {
			s.do(output.id, this)
		}, this)
	}
}

Transaction.prototype.__proto__ = ConsensusTransitionPrototype;

function FetchCollapse() {
	this.spent = {};
	this.unspent = {};

	var ignoreDo = {};
	var ignoreUndo = {};

	this.handle = function(state) {
		for (var name in state.domap) {
			if (!state.domap[name]) {
				ignoreDo[name] = true;
			} else {
				if (ignoreDo[name]) {
					delete ignoreDo[name];
				} else {
					this.unspent[name] = state.domap[name]
				}
			}
		}

		for (var name in state.undomap) {
			if (!state.undomap[name]) {
				ignoreUndo[name] = true;
			} else {
				if (ignoreUndo[name]) {
					delete ignoreUndo[name];
				} else {
					this.spent[name] = state.undomap[name]
				}
			}
		}

		return false;
	}
}

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
		var inputs = this.getRandomInputs(Math.floor(Math.random() * 2) + 1)
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

