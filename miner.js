function Miner(self) {
	var miner = this;
	self.miner = this;

	self.mprob = 0;

	this.difficulty = self.blockchain.chainstate.head.difficulty; // genesis block difficulty
	this.attacker_status = false;
	this.attacker_inv = {};
	this.attacker_tied = false;
	this.enabled = false;

	var updateDifficulty = function () {
		var cur = self.blockchain;
		if (self.miner.attacker_status)
			cur = self.private_blockchain;

		if (self.miner.difficulty != cur.chainstate.head.difficulty) {
			self.miner.difficulty = cur.chainstate.head.difficulty;

			if (self.miner.enabled) {
				self.miner.stopMining()
				self.miner.startMining()
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
					self.log("attacker: onBlock")
					var no = this.chainstate.enter(b)
					updateDifficulty();

					self.miner.attacker_tied = false;

					if (no >= 0) {
						// the new block defeated our chain
						self.log("attacker: adopted public chain at h=" + self.blockchain.chainstate.head.h)
						self.miner.attacker_inv = {};
					}

					if (self.blockchain.chainstate.head != this.chainstate.head) {
						if (self.blockchain.chainstate.head.h == this.chainstate.head.h) {
		           			// our chain is tied with the public chain
		           			// the next block we mine should be immediately released
		           			self.miner.attacker_tied = true;
			         	}

						var offset = 0;
						if (self.blockchain.chainstate.head.h == this.chainstate.head.h-1) {
							offset = 1;
						}

			            var release = this.chainstate.head;
			            var lead = 0;

			            while (release.h > (self.blockchain.chainstate.head.h+offset)) {
			              // if we can, don't publish anything more than one height above the public chain
			              lead++;
			              release = release._prev()
			            }

			            var releaseStack = [];

			            while (true) {
			            	if (typeof self.miner.attacker_inv[release.id] != "undefined") {
			            		delete self.miner.attacker_inv[release.id];
			            		releaseStack.push(release)
			            		release = release._prev()
			            	} else {
			            		break;
			            	}
			            }

			            var dorelease;
			            self.log("attacker: doing a release of " + releaseStack.length + " blocks")
			            while (dorelease = releaseStack.pop()) {
			            	self.log("attacker: \treleasing h=" + dorelease.h)
			            	self.blockchain.onMine.call(self.blockchain, dorelease, true)
			            }

			            self.log("attacker: published partial private chain up to h=" + (self.blockchain.chainstate.head.h) + " (new lead=" + lead + ")")
		           }
				}
				self.private_blockchain.onMine = function(b) {
					self.log("attacker: onMine")
					// don't publish blocks
					// just update chainstate
					this.chainstate.enter(b)

					if (self.miner.attacker_tied) {
					//if (false) {
						self.miner.attacker_tied = false;

						self.blockchain.onMine.call(self.blockchain, b, true)
					} else {
						// save it for later
						self.miner.attacker_inv[b.id] = true;
					}
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

				//console.log("[" + self.now() + "]: " + self.id + ": mined block at h=" + cur.chainstate.head.h)
				if (this.attacker_status)
					self.log("attacker: mined private block h=" + cur.chainstate.head.h + ", new lead " + (cur.chainstate.head.h - self.blockchain.chainstate.head.h))

			}, this)
		}
	}
}