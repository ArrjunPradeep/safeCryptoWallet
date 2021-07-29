var mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const schema = new mongoose.Schema({
	email: {
		type: String,
	},
	id: {
		type: String,
	},
	eth: {
		balance: {
			type: String,
			default: '0',
		},
		address: String,
	},
	bobe: {
		balance: {
			type: String,
			default: '0',
		},
		address: String
	},
	usdt: {
		balance: {
			type: String,
			default: '0',
		},
		address: String
	}
});

schema.plugin(mongoosePaginate);

module.exports = mongoose.model('wallets', schema);