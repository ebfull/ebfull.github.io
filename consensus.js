function StateTransitionValidation() {
	this.state = 2;
}

StateTransitionValidation.prototype = {
	VALID: 1, // State transition is completely valid here.
	PARTIAL: 2, // State transition is not yet fully valid.
	CONFLICT: 3, // State transition conflicts with another transition here.
	INVALID: 4, // State transition is otherwise invalid.
	DUPLICATE: 5, // State transition already occurred here.
}

var StateTransition = {
	id: 0x00,
	rand: function() {
		return String.fromCharCode(
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256)
			)
	},

	xor: function(b) {
		var a = this.id;
		var n = "";

		for (var i=0;i<a.length;i++) {
			n += String.fromCharCode(a.charCodeAt(i) ^ b.charCodeAt(i));
		}

		return n;
	},

	/*
		Apply this transition to the state object.
		Like setting unspent/spent outputs or storing metadata.

		THERE IS NO GUARANTEE OF ORDER OF APPLICATION, THAT SHOULD BE DONE BY VALIDATE
	*/
	apply: function(state) {

	},

	/*
		Unapply this transition on the state object.
		Like setting "ignoreunspent" and "ignorespent" outputs for the validator.
	*/

	unapply: function(state) {

	},

	/*
		Can we apply the transition to this state (delta)?
	*/
	validate: function(state, validation) {
		if (!validation) {
			validation = new StateTransitionValidation(this)
			// store something, like how many inputs we still need
		}

		// validation.state should be changed if:
		//  1. we need no more inputs, or whatever, then VALID
		//  2. we still need inputs, so PARTIAL
		//  3. this transition occurs within the state already, so DUPLICATE
		//  4. this transition conflicts with a different transition, so CONFLICT
		//  5. this transition is invalid for some reason, so INVALID

		return validation;
	},

	invalidate: function(state, validation) {
		if (!validation) {
			validation = new StateTransitionValidation(this)
		}

		// valid, duplicate or partial

		return validation;
	}
}

function ConsensusState(parent, transition) {
	this.transitions = []

	this.untransitions = [];
	this.parent = parent;
	this.children = [];
	this._retain = 0;

	if (parent) {
		this.id = parent.id;
		parent.children.push(this)
		this.root = parent.root;
	} else {
		this.id = StateTransition.rand();
		this.root = this;
		this.shifts = {};
		this.unshifts = {};
	}

	if (transition) {
		transition.apply(this)
		this.id = transition.xor(this.id)
	}
}

ConsensusState.prototype = {
	// returns a new state
	shift: function(transition, validation) {
		if (validation.state == validation.VALID) {
			// check the base object for cached transitions
			var n;

			if (this.root.shifts[transition.xor(this.id)]) {
				n = this.root.shifts[transition.xor(this.id)];
			} else {
				n = new ConsensusState(this, transition)

				// we need to cache this transition
				this.root.shifts[transition.xor(this.id)] = n;

				// new child means we retain
				n.retain();
			}

			// retain our new state
			n.retain();

			// release ourselves
			this.release();

			return n;
		}
		return false;
	},
	unshift: function(transition, validation) {
		if (validation.state == validation.VALID) {
			var n;

			if (this.root.unshifts[transition.xor(this.id)]) {
				n = this.root.unshifts[transition.xor(this.id)]
			} else {
				n = new ConsensusState(this, false);
				// unapply all of validation's transitions

				validation.untransitions.forEach(function(tr) {
					tr.unapply(n)
				}, this)

				this.root.unshifts[transition.xor(this.id)] = n

				n.retain(); // new child means retain
			}

			// retain our new state
			n.retain();

			// release ourselves
			this.release();

			return n;
		}

		return false;
	},
	validate: function(transition) {
		var cur = this;

		var validation = false; // store our validation state

		while (cur) {
			validation = transition.validate(cur, validation);

			switch (validation.state) {
				case validation.PARTIAL:
					// do nothing, continue up the chain
				break;
				case validation.VALID:
				case validation.CONFLICT:
				case validation.INVALID:
				case validation.DUPLICATE:
					return validation;
				break;
			}

			cur = cur.parent;
		}

		return validation;
	},
	invalidate: function(transition) {
		var cur = this;

		var validation = false;

		while(cur) {
			validation = transition.invalidate(cur, validation)

			switch(validation.state) {
				case validation.PARTIAL:
					// do nothing, continue up the chain
				break;
				case validation.VALID:
				case validation.CONFLICT:
				case validation.INVALID:
				case validation.DUPLICATE:
					return validation;
				break;
			}

			cur = cur.parent;
		}

		return validation;
	},
	retain: function() {
		this._retain++;
	},
	release: function() {
		this._retain--;

		if (this._retain == 0) {
			// We (may) serve as the parent for a number of child states in this.children
			// We should merge our state with all of our children

			// nothing will ever shift to this state
			delete this.root.shifts[this.id];

			this.children.forEach(function(child) {
				child.parent = this.parent;

				this.transitions.forEach(function(t) {
					t.apply(child) // apply parent transition to child state
				})

				child.release();
			}, this)

			this.children = []
		}
	}
}






/*
//////////////////////// INVENTORY STORAGE

function InventoryValidation(transition) {

}

InventoryValidation.prototype = new StateTransitionValidation();

function InventoryTransition(name, obj) {
	//this.name = name;
	//this.obj = obj;
	this.id = this.rand();

	this.apply = function(state) {
		if (typeof state.objs == "undefined") {
			state.objs = {};
		}

		state.objs[name] = obj;
	}

	this.unapply = function(state) {
		if (typeof state.ignoreobjs == "undefined") {
			state.ignoreobjs = {};
		}

		state.ignoreobjs[name] = obj;
	}

	this.validate = function(state, validation) {
		if (!validation) {
			validation = new InventoryValidation(this)
		}

		if (state.transitions.indexOf(this) != -1) {
			validation.state = validation.DUPLICATE;
		} else {
			validation.state = validation.VALID;
		}

		return validation;
	}

	this.invalidate = function(state, validation) {
		if (!validation) {
			validation = new InventoryValidation(this)
		}

		if (state.untransitions.indexOf(this) != -1) {
			validation.state = validation.DUPLICATE;
		} else {
			if (state.transitions.indexOf(this) != 1) {
				validation.state = validation.VALID;
			} else {
				// otherwise, remain PARTIAL
			}
		}

		return validation;
	}
}

InventoryTransition.prototype = StateTransition;


*/


///////////////// UTXO Storage


function UTXOTransition(inputs, outputs) {
	this.id = this.rand();

	this.apply = function(state) {
		if (typeof state.spents == "undefined")
			state.spents = {};
		if (typeof state.unspents == "undefined")
			state.unspents = {};
		if (typeof state.ignorespents == "undefined")
			state.ignorespents = {};
		if (typeof state.ignoreunspents == "undefined")
			state.ignoreunspents = {};

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

		if (typeof state.spents == "undefined")
			state.spents = {};
		if (typeof state.unspents == "undefined")
			state.unspents = {};
		if (typeof state.ignorespents == "undefined")
			state.ignorespents = {};
		if (typeof state.ignoreunspents == "undefined")
			state.ignoreunspents = {};

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

var root = new ConsensusState(false, false);
//root.retain()
root.spents = {}
root.unspents = {}
var tx1 = new UTXOTransition([], ["derp"])
var tx2 = new UTXOTransition(["derp"], ["herp", "slurp"])
var tx3 = new UTXOTransition(["herp"], ["lerp"])
var tx4 = new UTXOTransition(["slurp"], ["fag"])

var node1 = root;
node1.retain();

node1 = node1.shift(tx1, node1.validate(tx1))
node1 = node1.shift(tx2, node1.validate(tx2))
node1 = node1.shift(tx3, node1.validate(tx3))

node1 = node1.unshift(tx2, node1.invalidate(tx2))