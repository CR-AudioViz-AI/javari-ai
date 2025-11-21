import { JavariGreeting } from '../components';
import Head from 'next/head';

const JavariDemoPage = () => {
  return (
    <>
      <Head>
        <title>Javari Autonomous Build Demo</title>
        <meta name="description" content="Demo page showcasing Javari autonomous development" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main>
        <JavariGreeting />
      </main>
    </>
  );
};

export default JavariDemoPage;