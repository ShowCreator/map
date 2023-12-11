import React, { useEffect, type FC } from 'react';
import { MyEarth } from '../module';
import './index.less'

const Foo: FC<{ title: string }> = (props) => {
  useEffect(() => {
    var myEarth = new MyEarth();
    myEarth.initThree(document.getElementById('canvas'));
    myEarth.createChart({
      bg: 'rgb(10 ,20 ,28)',
      borderColor: 'rgb(10 ,20 ,28)',
      blurColor: '#000000',
      borderWidth: 2,
      blurWidth: 0,
      fillColor: 'rgb(26, 35, 44)',

      // bg: '#000080',
      // borderColor: '#1E90FF',
      // blurColor: '#1E90FF',
      // borderWidth: 1,
      // blurWidth: 5,
      // fillColor: 'rgb(30 ,144 ,255,0.3)',

      barHueStart: 0.7,
      barHueEnd: 0.2,
      barLightStart: 0.1,
      barLightEnd: 1.0,
      cameraPos: {
        x: 0.27000767404584447,
        y: 1.0782003329514755,
        z: 3.8134631736522793,
      },
      controlPos: {
        x: 0,
        y: 0,
        z: 0,
      },
    });
  }, []);

  return <div id="canvas"></div>;
};

export default Foo;
