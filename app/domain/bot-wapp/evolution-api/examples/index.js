const environment = "dev"

const url = environment === "dev" ? "http://localhost:8080" : "http://191.101.234.115:8088"

export {
    url
}