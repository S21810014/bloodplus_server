"use strict";
exports.__esModule = true;
var mysql = require("mysql");
var http = require("http");
var httpServer = http.createServer();
var BloodPlusDatabase = /** @class */ (function () {
    function BloodPlusDatabase() {
        this.conn = null;
        this.conn = mysql.createConnection({
            host: "localhost",
            user: "root",
            database: "blood_plus",
            password: ""
        });
    }
    BloodPlusDatabase.prototype.insert = function (sqlQuery, values) {
        var valuesDict = Object.keys(values).map(function (el) { return [el, values[el]]; });
        console.log(valuesDict);
    };
    return BloodPlusDatabase;
}());
var main = function () {
    var database = new BloodPlusDatabase();
    database.insert("TESTING", { name: "Timothy", age: 19 });
    // conn.query(
    //     "INSERT INTO pengguna " +
    //         "(nama, alamat, umur, jenis_kelamin, berat_badan, tinggi_badan, tipe_darah, nomor_telepon, password)" +
    //         "VALUES ('Revdian', 'Ratahan', 20, 'L', 45, 180, 'B+', '081243228136', 'helloworld')",
    //     (err, result) => {
    //         if(err) throw err;
    //
    //         console.log(result)
    //     }
    // )
    // conn.query(
    //     "SELECT * FROM pengguna",
    //     (err, result, fields) => {
    //         if(err) throw err
    //
    //         result.forEach(el => console.log(el.nama))
    //     }
    // )
};
main();
exports["default"] = main;
