function Miner(self) {
	var miner = this;

	self.mprob = 0;

	this.attacker_status = false;

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
					}
					else if (b.work == this.chainstate.head.work && this.chainstate.head != b) {
						// publish our block
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
			miner.startMining()
		} else {
			miner.attacker_status = false;
			delete self.private_blockchain;
		}
	}

	this.stopMining = function() {
		self.deprob("mining")
	}

	this.startMining = function() {
		if (self.mprob) {
			var cur;
			if (this.attacker_status)
				cur = self.private_blockchain;
			else
				cur = self.blockchain;

			self.prob("mining", self.mprob / cur.chainstate.head.difficulty, function() {
				cur.mineBlock()

				this.stopMining()
				this.startMining()
				if (this.attacker_status)
					self.log("attacker: mined private block h=" + cur.chainstate.head.h + ", new lead " + (cur.chainstate.head.h - self.blockchain.chainstate.head.h))
				//else
				//	console.log(self.id + ": mined block at h=" + cur.chainstate.head.h)
			}, this)
		}
	}
}