const chai = require("chai");
const expect = chai.expect;
const bcrypt = require("bcryptjs");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const User = require("../src/models/User");

let mongoServer;

describe("User model (integration)", function () {
	this.timeout(20000);

	before(async () => {
		mongoServer = await MongoMemoryServer.create();
		await mongoose.connect(mongoServer.getUri(), {
			dbName: "mocha_Test",
		});
	});

	after(async () => {
		if (mongoose.connection.readyState !== 0) {
			await mongoose.connection.dropDatabase();
			await mongoose.disconnect();
		}

		if (mongoServer) {
			await mongoServer.stop();
		}
	});

	beforeEach(async () => {
		await User.deleteMany({});
	});

	it("requires passwordHash for local auth provider", async () => {
		const user = new User({
			email: "local@example.com",
			firstName: "Local",
			lastName: "User",
			role: "clerk",
			authProvider: "local",
		});

		try {
			await user.save();
			throw new Error("Should fail");
		} catch (err) {
			expect(err.message).to.match(/Local users must have passwordHash/);
		}
	});

	it("requires googleId for google auth provider", async () => {
		const user = new User({
			email: "google@example.com",
			firstName: "Google",
			lastName: "User",
			role: "clerk",
			authProvider: "google",
		});

		try {
			await user.save();
			throw new Error("Should fail");
		} catch (err) {
			expect(err.message).to.match(/Google users must have googleId/);
		}
	});

	it("normalizes string department into array and exposes fullName", async () => {
		const user = await User.create({
			email: "doctor@example.com",
			passwordHash: "hashed-password",
			firstName: "Doc",
			lastName: "Tor",
			role: "doctor",
			department: " Medicine ",
		});

		expect(user.department).to.deep.equal(["Medicine"]);
		expect(user.fullName).to.equal("Doc Tor");
	});

	it("comparePassword returns true for matching password and false otherwise", async () => {
		const hash = await bcrypt.hash("Strong@123", 10);
		const user = await User.create({
			email: "compare@example.com",
			passwordHash: hash,
			firstName: "Com",
			lastName: "Pare",
			role: "clerk",
		});

		expect(await user.comparePassword("Strong@123")).to.equal(true);
		expect(await user.comparePassword("WrongPass1!")).to.equal(false);
	});

	it("toJSON omits passwordHash", async () => {
		const user = await User.create({
			email: "json@example.com",
			passwordHash: "hashed-password",
			firstName: "Json",
			lastName: "View",
			role: "clerk",
		});

		const json = user.toJSON();
		expect(json).to.not.have.property("passwordHash");
		expect(json.email).to.equal("json@example.com");
	});
});