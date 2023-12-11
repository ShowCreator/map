export class DillMap {
  public dillPath: any = []

  getGeoPath(item: any) {
    if (item?.adcode == 100000) {
      return item?.adcode.toString()
    }

    if (Array.isArray(item?.acroutes)) {
      const fatherPath = item.acroutes.join('/')
      return `${fatherPath}/${item.adcode}`
    }

    return null
  }

  getDillDownPath(item: any) {
    const path = this.getGeoPath(item.properties)
    console.log('path: ', path);
    let url = null
    try {
      url = require(`@/geoJsonFile/${path}.geoJson`)
    } catch {
      url = null
    }

    if (!url) {
      alert('已是最后一级')
      return null
    }
    return url
  }

  async handleDrillDown(item: any) {
    const path = this.getDillDownPath(item)

    this.dillPath.push({
      path: path,
    })
    const json = await this.loadMapGeoJson(path)
    return json
  }

  loadMapGeoJson(url: string) {
    return new Promise<void>((resolve, reject) => {
      fetch(url)
        .then((response) => response.json())
        .then((json) => {
          resolve(json)
        })
        .catch((error) => {
          reject(error)
        })
    })
  }
}
