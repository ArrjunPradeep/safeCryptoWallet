var mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const schema = new mongoose.Schema({
	email: {
		type: String,
	},
	id: {
		type: String,
	},
	bnb: {
		balance: {
			type: String,
			default: '0',
		},
		address: String,
		fee: Number
	},
	usdt: {
		balance: {
			type: String,
			default: '0',
		},
		address: String,
		fee: Number
	}
});

schema.plugin(mongoosePaginate);

module.exports = mongoose.model('wallets', schema);