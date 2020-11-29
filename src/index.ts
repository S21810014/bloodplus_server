import * as mysql from 'mysql'
import * as http from 'http'
import * as socketio from 'socket.io'
import * as fs from 'fs'
const Distance = require('geo-distance')

class BloodPlusDatabase {
    conn: mysql.Connection = null;

    constructor() {
        this.conn = mysql.createConnection({
            host: "192.168.43.147",
            user: "spyro",
            database: "blood_plus",
            password: "medusa",
            timezone: "Z"
        })
    }

    async insert(tableName: string, values: Object) : Promise<object> {
        let valuesDict: Array<Array<object>> = Object.keys(values).map(el => [el, values[el]])
        let querystring: string = `INSERT INTO ${tableName} (${valuesDict.map(el => el[0]).join(', ')}) VALUES (${valuesDict.map(el => `'${el[1]}'`).join(', ')})`;

        return await (() => {
            return new Promise<object>((resolve, reject) => {
                this.conn.query(
                    querystring,
                    (err, results, fields) => {
                        if (err) reject(err)

                        resolve(results)
                    }
                )
            })
        })()
    }

    async selectBintang(tableName: string) : Promise<object> {
        return await (() => {
            return new Promise<object>((resolve, reject) => {
                this.conn.query(
                    "SELECT * FROM " + tableName,
                    (err, results, fields) => {
                        if (err) reject(err)

                        resolve(results)
                    }
                )
            })
        })()
    }

    async selectFirstWithCondition(tableName: string, condition: object) : Promise<object> {
        return await (() => new Promise<object>((resolve, reject) => {
            let conditionDict: Array<Array<object>> = Object.keys(condition).map(el => [el, condition[el]])
            let querystring: string = `SELECT * FROM ${tableName} WHERE ${conditionDict.map(el => [el[0], `"${el[1]}"`]).map(el => el.join(' = ')).join(' AND ')}`

            this.conn.query(
                querystring,
                (err, results, fields) => {
                    if(err) reject(err)

                    resolve(results)
                }
            )
        }))()
    }
}

let activeUser: any = {}
activeUser["responder"] = new Array<object>()
activeUser["donors"] = new Array<object>()

let emergencies:  Array<any> = new Array<any>()

const main = async () => {
    let database: BloodPlusDatabase = new BloodPlusDatabase()

    const httpServer: http.Server = http.createServer()
    const sio: socketio.Server = socketio(httpServer)

    console.log(activeUser)

    sio.on("connection", (socket) => {
        socket.on('registerAccount', (data: object|string, callback: (returnVal: object | string) => void) => {
            let _data: any
            if(typeof(data) === "string") _data = JSON.parse(data)


            console.log("[registerAccount] ", data)


            if(_data.responder !== undefined) {
                delete _data.responder
                database.selectFirstWithCondition("responder", {nomor_telepon: _data.nomor_telepon}).then((resp: Array<object>) => {
                    if(resp.length < 1) {
                        database.insert("responder", _data)
                        callback({resp: "Not Exist and Inserted"})
                    } else {
                        callback({resp: "Already Exist and Ignored", ...resp[0]})
                    }
                })
            } else {
                database.selectFirstWithCondition("pengguna", {nomor_telepon: _data.nomor_telepon}).then((resp: Array<object>) => {
                    if(resp.length < 1) {
                        database.insert("pengguna", _data)
                        callback({resp: "Not Exist and Inserted"})
                    } else {
                        callback({resp: "Already Exist and Ignored", ...resp[0]})
                    }
                })
            }
        })

        socket.on('login', (data: object|string, callback: (returnVal: object | string) => void) => {
            let _data: any = undefined
            if(typeof(data) === "string") _data = JSON.parse(data)

            console.log("[login] ", _data)

            if(_data.responder !== undefined) {
                delete _data.responder
                database.selectFirstWithCondition("responder", _data).then((resp: Array<any>) => {
                    if(resp.length < 1) {
                        callback({resp: "Invalid"})
                    } else {
                        //console.log({resp: "Valid", ...resp[0]})
                        activeUser["responder"].push({...resp[0], socketid: socket.id})
                        console.log(activeUser)
                        callback({resp: "Valid", responder: "RESPONDER", ...resp[0]})
                    }
                })
            } else {
                database.selectFirstWithCondition("pengguna", _data).then((resp: Array<any>) => {
                    if(resp.length < 1) {
                        callback({resp: "Invalid"})
                    } else {
                        //console.log({resp: "Valid", ...resp[0]})
                        activeUser["donors"].push({...resp[0], socketid: socket.id})
                        console.log(activeUser)
                        callback({resp: "Valid", ...resp[0]})
                    }
                })
            }

            
        })

        socket.on('logout', (data, callback) => {
            if(typeof(data) == "string") data = JSON.parse(data)

            console.log("[logout] ", data)

            if(data.responder !== undefined) {
                console.log("[logout] IS RESPONDER " + data.nomor_telepon)
                let userIdx = activeUser["responder"].findIndex(el => el.nomor_telepon === data.nomor_telepon)
                if(userIdx !== -1) 
                {
                    console.log("[logout] USER FOUND AND REMOVING " + userIdx)
                    activeUser["responder"].splice(userIdx, 1)
                    console.log("[logout] active users: ", activeUser)
                }
            } else {
                console.log("[logout] IS NOT RESPONDER " + data.nomor_telepon)
                let userIdx = activeUser["donors"].findIndex(el => el.nomor_telepon === data.nomor_telepon)
                if(userIdx !== -1) {
                    console.log("[logout] USER FOUND AND REMOVING " + userIdx)
                    activeUser["donors"].splice(userIdx, 1)
                    console.log("[logout] active users: ", activeUser)
                }
            }

            callback({response: "Logged out"})
        });

        socket.on('responderSendEvent', (data, callback: (returnVal: any) => void) => {
            if(typeof(data) === "string") data = JSON.parse(data)

            console.log("[responderSendEvent] ", data)
            console.log("[responderSendEvent] sending callback")

            if(data.id_donor !== undefined) {
                let targetUser: any = activeUser['donors'].find(el => el.id === Number.parseInt(data.id_donor))

                if(targetUser !== undefined) {
                    if(emergencies.findIndex(el => el.id_donor === targetUser.id) === -1) {
                        sio.to(targetUser.socketid).emit('donorNotify', {...data, responderSocketId: socket.id})
                    } else {
                        console.log("[targetedResponderSendEvent] target currently responding to other responder")
                        callback("Pendonor sedang mendonorkan darah di responder lain")
                    }
                } else {
                    console.log("[targetedResponderSendEvent] target inactive")
                }
            } else {
                activeUser['donors'].filter(element => element.tipe_darah === data.bloodType).forEach(element => {
                    let rspndr: any = activeUser["responder"].find(el => data.id_responder === el.id);
    
                    rspndr = {lat: rspndr.latitude, lon: rspndr.longitude}
                    let dnr: any = {lat: element.latitude, lon: element.longitude}
                    
                    console.log("[distance]", Distance.between(rspndr, dnr).human_readable().distance + " km")
    
                    if(Distance.between(rspndr, dnr).human_readable().distance < 45)
                        if(emergencies.findIndex(el => el.id_donor === element.id) === -1)
                            sio.to(element.socketid).emit('donorNotify', {...data, responderSocketId: socket.id})
                        else
                            console.log("[responderSendEvent] target currently responding to other responder")
                    else
                        console.log("[responderSendEvent] target > 45 km")
                })
            }
        })

        socket.on('acknowledgeEvent', (data, callback) => {
            console.log('[acknowledgeEvent] ', data)

            emergencies.push(data)
            console.log('emergencies', data)
            sio.to(data.responderSocketId).emit('responderAcknowledge', {...data})
        })

        socket.on('eventDone', (data, callback) => {
            console.log('[eventDone] ', data)
            let notif: any = emergencies.splice(emergencies.indexOf(el => el.nomor_telepon_donor == data.nomor_telepon_donor), 1)[0];

            if(notif !== undefined)
            {
                database.insert("pendonoran", {
                    id_pengguna: notif.id_donor,
                    id_responder: notif.id_responder,
                    alamat: notif.alamat,
                    tipe_darah: notif.bloodType,
                    tanggal: notif.tanggal
                })

                activeUser["donors"].forEach(el => {
                    database.conn.query(
                        `SELECT r.nama, p.alamat, p.tanggal FROM pendonoran AS p INNER JOIN responder as r ON r.id = p.id_responder WHERE id_pengguna = ${el.id}`,
                        (err, results, fields) => {
                            if(err) throw err
        
                            sio.to(el.socketid).emit('updateHistoryTable', results)
                        }
                    )
                })

                activeUser["responder"].forEach(el => {
                    database.conn.query(
                        `SELECT png.id, png.nama, pnd.tipe_darah, pnd.tanggal FROM pendonoran AS pnd INNER JOIN pengguna AS png ON png.id = pnd.id_pengguna WHERE id_responder = ${el.id} GROUP BY pnd.id_pengguna ORDER BY pnd.tanggal DESC`,
                        (err, results, fields) => {
                            if(err) throw err
                            //console.log("[requestHistoryTable]", results)
                            sio.to(el.socketid).emit('updateLatestDonorTable', results)
                        }
                    )
                })
            }

            console.log(`event from ${data.responder} to ${data.nomor_telepon_donor} has completed and removed from list`)
            callback("ok");
        })

        socket.on('requestHistoryTable', (data, callback) => {
            console.log('[getProfileJpeg] ', data)

            database.conn.query(
                `SELECT r.nama, p.alamat, p.tanggal FROM pendonoran AS p INNER JOIN responder as r ON r.id = p.id_responder WHERE id_pengguna = ${data}`,
                (err, results, fields) => {
                    if(err) throw err
                    //console.log("[requestHistoryTable]", results)
                    callback(results)
                }
            )
            
        })

        socket.on('getProfileJpeg', (data, callback) => {
            console.log('[getProfileJpeg] ', data.phoneNumber)
            //console.log(data)
            // const bytes = Buffer.from(data, "utf-8")

            fs.writeFile(data.phoneNumber, data.bytes, {encoding: 'base64'}, err => {
                socket.emit('profileJpegUpdate', data.bytes);
            })
            //console.log(data)
        })

        socket.on('requestProfileJpeg', (data, callback) => {
            console.log('[requestProfileJpeg] ', data)

            fs.readFile(data.phoneNumber, {encoding: "base64"}, (err, fdata) => {
                if(err) {
                    callback({retval: 'error'})
                }

                callback({retval: 'success', bytes: fdata})
            })
        })

        socket.on('requestLatestDonor', (data, callback) => {
            console.log('[requestLatestDonor]', data)

            database.conn.query(
                `SELECT png.id, png.nama, pnd.tipe_darah, pnd.tanggal FROM pendonoran AS pnd INNER JOIN pengguna AS png ON png.id = pnd.id_pengguna WHERE id_responder = ${data} GROUP BY pnd.id_pengguna ORDER BY pnd.tanggal DESC`,
                (err, results, fields) => {
                    if(err) throw err
                    //console.log("[requestHistoryTable]", results)
                    callback(results)
                }
            )
        })
    })

    httpServer.listen(5000, () => {
        console.log("server started on 5000")
    })
    console.log("lol")
}

main()