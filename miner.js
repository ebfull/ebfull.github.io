function Miner(self) {
	self.mprob = 0.005;

	this.startMining = function() {
		self.prob("mining", self.mprob / self.blockchain.chainstate.head.difficulty, function() {
			self.blockchain.mineBlock()

			//console.log(self.id + " found a block at height " + self.blockchain.chainstate.head.h)

			self.deprob("mining")
			this.startMining()
		}, this)
	}

	this.startMining()
}