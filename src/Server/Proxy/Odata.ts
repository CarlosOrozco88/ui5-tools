import Config from '../../Utils/ConfigVscode';
import { ServerOptions } from '../../Types/Types';
import Gateway from './Odata/Gateway';
import Other from './Odata/Other';

export default {
  async set(serverOptions: ServerOptions): Promise<void> {
    const odataProxy = Config.server('odataProxy') as string;

    const OPTIONS: Record<string, () => void> = {
      Gateway: () => {
        Gateway.set(serverOptions);
      },
      Other: () => {
        Other.set(serverOptions);
      },
    };

    await OPTIONS[odataProxy]?.();
  },
};
