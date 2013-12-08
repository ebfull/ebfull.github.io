var colors = ["red", "green", "orange", "blue", "purple", "pink"]
var color_i = 0;

function Block(prev, time, miner) {
	this._prev = function() {
		return prev;
	}

	if (miner)
		this.credit = miner.id;
	else
		this.credit = false;

	this.id = StateTransition.rand();
	this.time = time;
	this.color = colors[color_i]
	if (typeof this.color == "undefined") {
		color_i = 0;
		this.color = colors[color_i]
	} else {
		color_i++;
	}

	if (prev) {
		this.h = prev.h + 1;
		this.prev = prev.id;
		this.difficulty = prev.difficulty;
		this.work = prev.work + prev.difficulty;

		// TODO: difficulty adjustment
		if (!(this.h % this.difficulty_adjustment_period)) {
			this.difficultyAdjustment()
		}
	}
	else {
		this.h = 0;
		this.prev = false;
		this.difficulty = 120000;
		this.work = 0;
	}
}

Block.prototype = {
	target_avg_between_blocks: 2.5 * 60 * 1000, // 2.5 minutes = litecoin
	difficulty_adjustment_period: 2016,

	difficultyAdjustment: function() {
		var total = 0;
		var last = this.time;
		var cur = this._prev();

		for (var i=0;i<this.difficulty_adjustment_period;i++) {
			total += last - cur.time;
			last = cur.time;
			cur = cur._prev()
		}
		var avg = total / this.difficulty_adjustment_period;

		var old = this.difficulty;
		this.difficulty *= this.target_avg_between_blocks / avg;

		console.log("(h=" + this.h + ") difficulty adjustment " + (this.target_avg_between_blocks / avg) + "x")
	}
}

var GenesisBlock = new Block(false, 0);

function Chainstate(head, self) {
	this.self = self;
	this.forward(head)
}

Chainstate.prototype = {
	forward: function(b) {
		this.self.setColor(b.color)
		this.head = b
		// TODO: run transactions here
	},
	reverse: function() {
		this.head = this.head._prev()
	},
	/*
		This function attempts to enter the block into the chainstate.
	*/
	enter: function(block, force) {
		if (block == this.head)
			return -1

		if (typeof force == "undefined")
			force = false;
		else if (force)
			this.self.log("\tchainstate forcefully entering branch")

		var numorphan = -1;

		if ((this.head.work < block.work) || force) {
			// the current head is now obsolete

			numorphan = 0;
			var forwards = []
			var cur = block

			reorg:
			while(true) {
				if (cur.h > this.head.h) {
					forwards.push(cur)
					cur = cur._prev()
				} else if (cur == this.head) {
					while(true) {
						if (forwards.length > 0) {
							this.forward(forwards.pop())
						} else {
							break reorg;
						}
					}
				} else {
					numorphan++;
					this.reverse()
				}
			}
		} else if (this.head.work == block.work) {
			this.self.log("\tblock rejected; already seen one at this chainlength")
		}

		return numorphan
	}
}

function Blockchain(self, instance) {
	if (typeof instance == "undefined")
		instance = "blockchain"

	self[instance] = this;
	this.chainstate = new Chainstate(GenesisBlock, self);

	this.onBlock = function(b) {
		this.chainstate.enter(b)
	}

	this.onMine = function(b, force) {
		if (this.chainstate.enter(b, force) != -1) {
			self.log("\tpushing new inventory object")
			self.inventory.createObj("block", {name:b.id,block:b})
		}
	}

	this.mineBlock = function() {
		var newb = new Block(this.chainstate.head, self.now(), self)

		this.onMine(newb)
	}

	self.on("inv:block", function(from, o) {
		this.onBlock(o.obj.block)
	}, this)

	self.inventory.subscribe("block")
}