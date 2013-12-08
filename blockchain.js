var colors = ["red", "green", "orange", "blue", "purple", "pink"]
var color_i = 0;

function Block(prev, time, miner) {
	this._prev = function() {
		return prev;
	}

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
		this.difficulty = 10000;
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
	enter: function(block) {
		if (block == this.head)
			return 0

		if (this.head.work < block.work) {
			// the current head is now obsolete

			var numorphan = 0;
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
				} else /*if (this.head.h > cur.h)*/ {
					numorphan++;
					this.reverse()
				}
			}

			return numorphan
		}
	}
}

function Blockchain(self) {
	self.blockchain = this;

	this.chainstate = new Chainstate(GenesisBlock, self);

	this.mineBlock = function() {
		var newb = new Block(this.chainstate.head, self.now(), self)

		this.chainstate.enter(newb)

		self.inventory.createObj("block", {name:newb.id,block:newb})
	}

	self.on("inv:block", function(from, o) {
		var block = o.obj.block;

		this.chainstate.enter(block)
	}, this)

	self.inventory.subscribe("block")
}