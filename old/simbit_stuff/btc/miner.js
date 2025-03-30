function Miner(self) {
	self.miner = this;

	this.restage = function () {
		self.miner.difficulty = self.miner.staged.difficulty;
		if (self.miner.enabled) {
			self.miner.stopMining()
			self.miner.startMining()
		}
	}

	self.mprob = 0;
	this.mcb = function() {
		return new self.blockchain.Block(self.blockchain.chainstate.head, self.now(), self);
	}
	this.staged = false;
	this.enabled = false;
	this.difficulty = false;

	// expose mine() to NodeState
	self.mine = function(amt, cb) {
		this.mprob = amt;
		if (cb)
			self.miner.mcb = cb;

		self.miner.startMining();
	}

	this.stopMining = function() {
		if (!this.enabled)
			return;

		this.enabled = false;
		self.deprob("mining")
	}

	this.startMining = function() {
		if (this.enabled)
			return;

		this.staged = this.mcb.call(self); // restage next block
		this.difficulty = this.staged.difficulty;
		this.enabled = true;

		if (self.mprob) {
			self.prob("mining", self.mprob / this.staged.difficulty, function() {
				self.handle(-1, "miner:success", this.staged);

				this.restage();
			}, this)
		}
	}

	self.on("miner:success", function(from, b) {
		b.time = self.now();
		b.transactions = self.mempool.getList();

		self.inventory.createObj("block", b)

		if (self.blockchain.chainstate.enter(b) != -1) {
			self.inventory.relay(b.id, true);
		}
	}, this)

	self.on("blockchain:block", function(from, b) {
		this.restage();
	}, this)
}

module.exports = Miner;