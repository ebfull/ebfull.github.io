function NodeObject(type, name, obj) {
	this.type = type;
	if (!name)
		name = (Math.floor((1 + Math.random()) * 0x10000)
             .toString(16)
             .substring(1)) + (Math.floor((1 + Math.random()) * 0x10000)
             .toString(16)
             .substring(1)) + (Math.floor((1 + Math.random()) * 0x10000)
             .toString(16)
             .substring(1));

	this.name = name;
	this.obj = obj;

	this.retain = 0;
}

function ObjectCollection(base) {
	if (typeof base == "undefined") {
		base = false;
	} else {
		base.children.push(this);
	}

	this.children = [];
	this.base = base;
	this.objectMap = {};
}

ObjectCollection.prototype = {
	// returns TRUE if it's already in our inventory
	exists: function(name) {
		if (typeof this.objectMap[name] != "undefined") {
			return true;
		}

		if (this.base && this.base.exists(name)) {
			return true;
		}

		return false;
	},

	add: function(obj) {
		if (this.exists(obj.name)) {
			return false;
		}

		this.objectMap[obj.name] = obj;

		obj.retain++;

		if (obj.retain == this.base.children.length) {
			// cheap way of figuring out if we've reached network wide consensus and can merge the object
			// into the shared collection

			this.base.objectMap[obj.name] = obj;

			// delete it from every single children objectcollection
			this.base.children.forEach(function(child) {
				delete child.objectMap[obj.name];
			});
		}

		return true;
	},
}

function Inventory(self) {
	self.inventory = new ObjectCollection(self.network.shared("inventory", ObjectCollection));
}