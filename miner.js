function Miner(self) {
	var miner = this;
	self.miner = this;

	self.mprob = 0;

	this.difficulty = self.blockchain.chainstate.head.difficulty; // genesis block difficulty
	this.attacker_status = false;
	this.enabled = false;

	var updateDifficulty = function () {
		if (self.miner.attacker_status) {
			// we're the attacker

			if (self.miner.difficulty != self.private_blockchain.chainstate.head.difficulty) {
				self.miner.difficulty = self.private_blockchain.chainstate.head.difficulty;

				if (self.miner.enabled) {
					self.miner.stopMining()
					self.miner.startMining()
				}
			}
		} else {
			// we're just an honest miner

			if (self.miner.difficulty != self.blockchain.chainstate.head.difficulty) {
				self.miner.difficulty = self.blockchain.chainstate.head.difficulty;

				if (self.miner.enabled) {
					self.miner.stopMining()
					self.miner.startMining()
				}
			}
		}
	}

	// Hook the onBlock routine for the public blockchain
	var oldNormalOnBlock = self.blockchain.onBlock;
	self.blockchain.onBlock = function(b) {
		oldNormalOnBlock.call(self.blockchain, b)

		updateDifficulty();
	}

	self.mine = function(amt) {
		this.mprob = amt;

		miner.startMining();
	}

	self.attack = function() {
		if (!miner.attacker_status) {
			miner.stopMining()
			miner.attacker_status = true;

			if (typeof self.private_blockchain == "undefined") {
				new Blockchain(self, "private_blockchain")
				var oldOnBlock = self.private_blockchain.onBlock
				self.private_blockchain.onBlock = function(b) {
					if (b.work > this.chainstate.head.work) {
						// we're defeated. adopt this block
						self.log("attacker: adopting public chain at h=" + b.h)
						oldOnBlock.call(this, b)

						updateDifficulty();
					}
					else if (b.work == this.chainstate.head.work && this.chainstate.head != b) {
						self.blockchain.onMine.call(self.blockchain, this.chainstate.head, true)
						self.log("attacker: published full private chain h=" + this.chainstate.head.h)
					} else if (b != this.chainstate.head) {
			            var release = this.chainstate.head;
			            var lead = 0;

			            while (release.h > (b.h+1)) {
			              // if we can, don't publish anything more than one height above the public chain
			              lead++;
			              release = release._prev()
			            }

			            // now let's publish this block
			            self.blockchain.onMine.call(self.blockchain, release, true)
			            self.log("attacker: published partial private chain up to h=" + (release.h) + " (new lead=" + lead + ")")
		           }

				}
				self.private_blockchain.onMine = function(b) {
					// don't publish blocks
					// just update chainstate
					this.chainstate.enter(b)
				}
			}
			self.private_blockchain.onBlock(self.blockchain.chainstate.head)

			updateDifficulty()

			miner.startMining()
		} else {
			miner.attacker_status = false;
			delete self.private_blockchain;

			updateDifficulty()
		}
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

		this.enabled = true;

		if (self.mprob) {
			var cur;
			if (this.attacker_status)
				cur = self.private_blockchain;
			else
				cur = self.blockchain;

			self.prob("mining", self.mprob / cur.chainstate.head.difficulty, function() {
				cur.mineBlock()

				updateDifficulty()

				if (this.attacker_status)
					self.log("attacker: mined private block h=" + cur.chainstate.head.h + ", new lead " + (cur.chainstate.head.h - self.blockchain.chainstate.head.h))
				//else
				//	console.log(self.id + ": mined block at h=" + cur.chainstate.head.h)
			}, this)
		}
	}
}