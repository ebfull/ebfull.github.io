function UTXOTransition(inputs, outputs) {
	this.id = this.rand();

	this.init = function(state) {
		if (typeof state.spents == "undefined") {
			state.spents = {};
			state.unspents = {};
			state.ignorespents = {};
			state.ignoreunspents = {};
		}
	}

	this.apply = function(state) {
		this.init(state)

		if (state.untransitions.indexOf(this) != -1) {
			// remove this transition from untransitions
			state.untransitions.splice(state.untransitions.indexOf(this), 1)

			// remove this transitions' untransitions oh god what the fuck is happening
			inputs.forEach(function(input) {
				delete state.ignorespents[input];
			}, this)

			outputs.forEach(function(output) {
				delete state.ignoreunspents[output];
			}, this)
		} else {
			inputs.forEach(function(input) {
				state.spents[input] = this;
			}, this)

			outputs.forEach(function(output) {
				state.unspents[output] = this;
			}, this)

			state.transitions.unshift(this)
		}
	}

	this.unapply = function(state) {
		if (state.untransitions.indexOf(this) != -1)
			return; // don't unapply twice (happens in long reorgs)

		this.init(state)

		// set ignoreunspents and ignorespents
		inputs.forEach(function(input) {
			state.ignorespents[input] = this;
		}, this)

		outputs.forEach(function(output) {
			state.ignoreunspents[output] = this;
		}, this)

		state.id = this.xor(state.id)

		state.untransitions.unshift(this)
	}

	this.validate = function(state, validation) {
		if (!validation) {
			validation = new StateTransitionValidation(this)
			validation.inputsMissing = inputs.slice(0); // keep track of inputs we're missing
			validation.ignoreSpents = {};
			validation.ignoreUnspents = {};
			validation.untransitions = [];
		}

		validation.untransitions = validation.untransitions.concat(state.untransitions);

		if (state.ignoreunspents) {
			for (var sp in state.ignoreunspents) {
				validation.ignoreUnspents[sp] = state.ignoreunspents[sp]
			}
		}

		if (state.ignorespents) {
			for (var usp in state.ignorespents) {
				validation.ignoreSpents[usp] = state.ignorespents[usp]
			}
		}

		if (state.transitions.indexOf(this) != -1) {
			if (validation.untransitions.indexOf(this) != -1) {
				// remove untransition
				validation.untransitions.splice(validation.untransitions.indexOf(this), 1)
			} else {
				// this state already performs our transition
				validation.state = validation.DUPLICATE;

				return validation;
			}
		} else {
			inputs.forEach(function(input) {
				// we shouldn't find our input being spent by another transition
				if (typeof state.spents[input] != "undefined") {
					if (typeof validation.ignoreSpents[input] != "undefined") {
						delete validation.ignoreSpents[input]
					} else {
						// someone spent this!
						validation.state = validation.CONFLICT;
						validation.conflictTx = state.spents[input];

						return validation;
					}
				}
			})

			validation.inputsMissing.forEach(function(missingInput) {
				if (typeof state.unspents[missingInput] != "undefined") {
					if (typeof validation.ignoreUnspents[missingInput] != "undefined") {
						delete validation.ignoreUnspents[missingInput]
					} else {
						validation.inputsMissing.splice(validation.inputsMissing.indexOf(missingInput), 1) // remove the missingInput, we found it
					}
				}
			})
		}

		if (validation.inputsMissing.length == 0) {
			validation.state = validation.VALID;
		}

		return validation;
	}

	this.invalidate = function(state, validation) {
		if (!validation) {
			validation = new StateTransitionValidation(this)
			validation.base = state;
			validation.untransitions = [this]; // array of transitions we intend to remove
			validation.outputsSeeking = outputs.slice(0)
		}

		if (state.transitions.indexOf(this) != -1) {
			// found the transition
			validation.state = validation.VALID;
		}

		validation.outputsSeeking.forEach(function(output) {
			if (typeof state.spents[output] != "undefined") {
				validation.outputsSeeking.splice(validation.outputsSeeking.indexOf(output), 1) // we're no longer worried about this output being spent

				// validate the removal of this
				var sub = state.spents[output].invalidate(validation.base, false)

				// merge its untransitions with ours
				validation.untransitions = validation.untransitions.concat(sub.untransitions)
			}
		})

		return validation;
	}
}

UTXOTransition.prototype = StateTransition;

function Transactions(self) {
	self.mempool = this;
	this.utxo = self.network.shared("utxo")
	this.utxo.retain()

	this.addTransaction = function(tx) {
		var val = this.utxo.validate(tx)

		if (val.state == val.VALID) {
			this.utxo = this.utxo.shift(tx, val)
		}
	}

	this.createTransaction = function(inputs, outputs) {
		var tx = new UTXOTransition(inputs, outputs)

		this.addTransaction(tx)

		// add to inventory
		self.inventory.createObj("tx", {name:tx.id,tx:tx})
	}

	self.on("inv:tx", function(from, inv) {
		this.addTransaction(inv.obj.tx)
	}, this)
}

