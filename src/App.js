import React, { useEffect, useRef, useState } from 'react';
import { initNotifications, notify } from '@mycv/f8-notification';
import { Howl } from 'howler';
import '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as knnClassifier from '@tensorflow-models/knn-classifier';
import styles from './App.module.scss';
import soundURL from './assets/hey_sondn.mp3';

var sound = new Howl({
  src: [soundURL]
});

const NOT_TOUCH_LABEL = 'not touch';
const TOUCHED_LABEL = 'touched';
const TRANING_TIMES = 50;
const TOUCHED_CONFIDENCE = 0.8;

function App() {
  const video = useRef();
  const classifier = useRef();
  const canPlaySound = useRef(true);
  const mobilenetModule = useRef();
  const [touched, setTouched] = useState(false);
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState('');

  const init = async () => {
    setMessage('Đang tìm kiếm camera...');

    await setupCamera();

    setMessage('Đang khởi động AI...');

    classifier.current = knnClassifier.create();

    mobilenetModule.current = await mobilenet.load();

    initNotifications({ cooldown: 3000 });

    setStep(1);
    setMessage('Bước 1: Quay video không chạm tay lên mặt!');
  }

  const setupCamera = () => {
    return new Promise((resolve, reject) => {
      navigator.getUserMedia = navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia;

      if (navigator.getUserMedia) {
        navigator.getUserMedia(
          { video: true },
          stream => {
            video.current.srcObject = stream;
            video.current.addEventListener('loadeddata', resolve);
          },
          error => reject(error)
        );
      } else {
        reject();
      }
    });
  }

  /**
   * Bước 1: Train cho máy khuôn mặt không chạm tay
   * Bước 2: Train cho máy khuôn mặt có chạm tay
   * Bước 3: Lấy hình ảnh hiện tại, phân tích và so sánh với data đã học trước đó
   * ==> Nếu mà matching với data khuôn mặt chạm tạy ==> Cảnh báo
   * @param {*} label 
   */

  const train = async label => {
    console.log(`[${label}] Training for machine of my handsome face...`);
    for (let i = 0; i < TRANING_TIMES; i++) {
      if (label === NOT_TOUCH_LABEL) {
        setMessage(`Không chạm tay lên mặt cho tới khi hoàn thành. Máy đang học... ${parseInt((i + 1) / TRANING_TIMES * 100)}%`);
      } else {
        setMessage(`Giữ tay trong tầm nhìn camera cho tới khi hoàn thành. Máy đang học... ${parseInt((i + 1) / TRANING_TIMES * 100)}%`);
      };

      await training(label);
    }
    setStep(step + 1);

    if (label === NOT_TOUCH_LABEL) {
      setMessage('Bước 2: Quay video đưa tay gần lên mặt (cách 10cm)');
    } else {
      setMessage('AI đã sẵn sàng, hãy bấm Khởi động!');
    }
  }

  const training = label => {
    return new Promise(async resolve => {
      const embedding = mobilenetModule.current.infer(
        video.current,
        true
      );
      classifier.current.addExample(embedding, label);
      await sleep(100);
      resolve();
    });
  }

  const run = async () => {
    setMessage('AI đang theo dõi tay của bạn...');

    const embedding = mobilenetModule.current.infer(
      video.current,
      true
    );
    const result = await classifier.current.predictClass(embedding);

    if (
      result.label === TOUCHED_LABEL &&
      result.confidences[result.label] > TOUCHED_CONFIDENCE
    ) {
      if (canPlaySound.current) {
        canPlaySound.current = false;
        sound.play();
      }
      notify('Bỏ tay ra!', { body: 'Bạn vừa chạm tay vào mặt!' });
      setTouched(true);
      document.title = 'Bỏ tay ra!';
    } else {
      setTouched(false);
      document.title = 'Đừng chạm tay lên mặt!';
    }

    await sleep(200);

    run();
  }

  const sleep = (ms = 0) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  useEffect(() => {
    init();

    sound.on('end', function () {
      canPlaySound.current = true;
    });

    //cleanup
    return () => {

    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mainStyles = [styles.main];
  if (touched) {
    mainStyles.push(styles.touched);
  }

  return (
    <div className={mainStyles.join(' ')}>
      <video
        ref={video}
        className={styles.video}
        autoPlay
      />

      <div className={styles.message}>
        {message}
      </div>

      <div className={styles.control}>
        {step === 1 && (
          <button className={styles.btn} onClick={() => train(NOT_TOUCH_LABEL)}>Bắt đầu</button>
        )}
        {step === 2 && (
          <button className={styles.btn} onClick={() => train(TOUCHED_LABEL)}>Tiếp tục</button>
        )}
        {step === 3 && (
          <button className={styles.btn} onClick={() => run()}>Khởi động!</button>
        )}
      </div>

      <a className={styles.guideLink} target="_blank" rel="noopener noreferrer" href="baodien1405.surge.sh">Hướng dẫn</a>
    </div>
  );
}

export default App;
