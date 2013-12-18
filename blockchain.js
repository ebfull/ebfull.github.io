var colors = ["green", "orange", "blue", "purple", "brown", "steelblue"]
var color_i = 0;

function Block(prev, time, miner) {
	this._prev = function() {
		return prev;
	}

	if (miner)
		this.credit = miner.id;
	else
		this.credit = false;

	this.id = ConsensusState.prototype.rand();
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
		this.difficulty = 600000;
		//this.difficulty = 3000;
		this.work = 0;
	}
}

Block.prototype = {
	target_avg_between_blocks: 10 * 60 * 1000,
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

	this.prevs = [];
	this.mapOrphansByPrev = {};
	this.mapOrphans = {};

	this.forward(head)
}

Chainstate.prototype = {
	forward: function(b) {
		this.self.setColor(b.color)
		this.head = b
		
		this.prevs.push(b.id)

		delete this.mapOrphans[this.head.id];
		
		if (typeof this.mapOrphansByPrev[this.head._prev().id] != "undefined") {
			var i = this.mapOrphansByPrev[this.head._prev().id].indexOf(this.head)
			if (i != -1) {
				this.mapOrphansByPrev[this.head._prev().id].splice(i, 1)
			}
		}

	},
	reverse: function() {
		this.mapOrphans[this.head.id] = this.head;
		if (typeof this.mapOrphansByPrev[this.head._prev().id] == "undefined") {
			this.mapOrphansByPrev[this.head._prev().id] = []
		}
		this.mapOrphansByPrev[this.head._prev().id].push(this.head)

		this.head = this.head._prev()

		this.prevs.pop()
	},
	getOrphanWorkPath: function(block) {
		var works = [];

		if (typeof this.mapOrphansByPrev[block.id] != "undefined") {
			this.mapOrphansByPrev[block.id].forEach(function(sub) {
				works.push(this.getOrphanWorkPath(sub))
			}, this)
		}

		if (works.length == 0) {
			// there aren't any subworks
			return {end:block,work:block.work}
		} else {
			// pick the largest one
			var largestWork = {end:false,work:Number.NEGATIVE_INFINITY};

			works.forEach(function(subwork) {
				if (subwork.work > largestWork.work) {
					largestWork = subwork;
				}
			})

			// return it
			return largestWork;
		}
	},
	reorg: function(block, numorphan, force) {
		var ourorphans = 0;
		if (numorphan == -1) {
			// This block couldn't be entered into the chainstate, so it's an orphan.
			if (typeof this.mapOrphans[block.id] == "undefined") {
				this.mapOrphans[block.id] = block;
				if (typeof this.mapOrphansByPrev[block._prev().id] == "undefined") {
					this.mapOrphansByPrev[block._prev().id] = [];
				}
				this.mapOrphansByPrev[block._prev().id].push(block)
			} else {
				return numorphan;
			}
		}

		// maybe it completes a chain though
		var cur = block;

		while(true) {
			if (this.prevs.indexOf(cur.id) != -1) {
				var bestOrphanPath = this.getOrphanWorkPath(cur)
				if ((force && bestOrphanPath.work >= this.head.work) || bestOrphanPath.work > this.head.work) {
					//console.log(this.self.id + ": adopting orphan chain of (w=" + bestOrphanPath.work + " vs. local " + this.head.work + ")")
					ourorphans += this.enter(bestOrphanPath.end, true, true)
				}

				break;
			} else {
				cur = cur._prev();
			}
		}
		if (numorphan == -1) {
			if (ourorphans == 0)
				return numorphan;
			else
				return ourorphans
		}
		else
			return numorphan + ourorphans;
	},
	enter: function(block, force, doingReorg) {
		this.self.log((doingReorg ? "(reorg) " : "") + "entering new block at height " + block.h)
		if (block == this.head)
			return -1

		if (this.prevs.indexOf(block._prev().id) == -1) {
			if (!doingReorg)
				return this.reorg(block, -1, force)
		}

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

		if (!doingReorg)
			numorphan = this.reorg(block, numorphan)

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
	// TODO: block validation time
	//	self.delay(Math.floor(Math.random()*3000)+10, function() {
			this.onBlock(o.obj.block)
	//	}, this)
	}, this)

	self.inventory.subscribe("block")
}